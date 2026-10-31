import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { AppProvider, useApp, type AppContext } from '../src/state';
import type { Item } from '../src/db/types';
import { listSelectedItems } from '../src/db/items';
import { upsertFeed } from '../src/db/feeds';
import { bulkUpsertItems } from '../src/db/items';
import { getDb } from '../src/db/open';

vi.mock('../src/db/items', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/db/items')>(),
  listSelectedItems: vi.fn(),
}));
vi.mock('../src/sync/init', () => ({
  bootSync: vi.fn(async () => {}),
  pullIfStale: vi.fn(async () => {}),
  pullNow: vi.fn(async () => {}),
  triggerFirstTime: vi.fn(async () => {}),
}));
vi.mock('../src/sync/capabilities', () => ({
  isSyncAvailable: async () => false,
  getSyncCapabilities: async () => ({ sync: false, stats: false, items: false }),
  isStatsSyncAvailable: async () => false,
  isItemSyncAvailable: async () => false,
  resetSyncCapabilityCache: () => {},
}));

let ctx: AppContext;
let dispose: (() => void) | undefined;
function Probe() { ctx = useApp(); return null; }
const item = (id: string): Item => ({ id, feedId: 'feed', guid: id, title: id, publishedAt: 1, updatedAt: 1, excerpt: '', read: false, starred: false, createdAt: 1 });
const result = (items: Item[]) => ({ items, hasStoredItems: items.length > 0 });

beforeEach(async () => {
  const db = await getDb();
  for (const store of ['feeds', 'items', 'itemBodies', 'itemFlags', 'feedStats', 'readMarkers', 'meta'] as const) await db.clear(store);
  vi.mocked(listSelectedItems).mockReset();
  vi.mocked(listSelectedItems).mockResolvedValue(result([item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  window.innerWidth = 1200;
  history.replaceState(null, '', '/');
  document.body.innerHTML = '';
  await upsertFeed({ id: 'feed', url: 'https://example.com/feed.xml', title: 'Feed', learnedIntervalMs: 3_600_000, lastFetched: Date.now() });
  await bulkUpsertItems([item('old')]);
});
afterEach(() => { dispose?.(); dispose = undefined; vi.restoreAllMocks(); });

async function mount() {
  dispose = render(() => <AppProvider><Probe /></AppProvider>, document.body);
  await vi.waitFor(() => expect(ctx.hydrated()).toBe(true));
}

describe('library update reconciliation', () => {
  it('acknowledges a manual refresh synchronously and coalesces repeated actions', async () => {
    await mount();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 304 }));
    const first = ctx.refreshSelected();
    expect(ctx.fetching()).toBe(1);
    const repeated = ctx.refreshSelected();
    expect(ctx.fetching()).toBe(1);
    await Promise.all([first, repeated]);
    expect(ctx.fetching()).toBe(0);
  });

  it('replays a stale background query and promotes a concurrent explicit request', async () => {
    await mount();
    let finishStale: ((value: ReturnType<typeof result>) => void) | undefined;
    let finishCurrent: ((value: ReturnType<typeof result>) => void) | undefined;
    vi.mocked(listSelectedItems)
      .mockReturnValueOnce(new Promise((resolve) => { finishStale = resolve; }) as ReturnType<typeof listSelectedItems>)
      .mockReturnValueOnce(new Promise((resolve) => { finishCurrent = resolve; }) as ReturnType<typeof listSelectedItems>);

    const background = ctx.reloadItems(true);
    await vi.waitFor(() => expect(listSelectedItems).toHaveBeenCalledTimes(2));
    const explicit = ctx.reloadItems(false);
    finishStale?.(result([item('new'), item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await vi.waitFor(() => expect(listSelectedItems).toHaveBeenCalledTimes(3));
    finishCurrent?.(result([item('new'), item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await Promise.all([background, explicit]);

    expect(ctx.items().map(({ id }) => id)).toEqual(['new', 'old']);
    expect(ctx.pendingUpdateLabel()).toBeNull();
  });

  it('holds a background candidate until Show is activated, then commits the newest result', async () => {
    await mount();
    vi.mocked(listSelectedItems).mockResolvedValueOnce(result([item('new'), item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await ctx.reloadItems(true);
    expect(ctx.items().map(({ id }) => id)).toEqual(['old']);
    expect(ctx.pendingUpdateLabel()).toBe('Show 1 new');
    vi.mocked(listSelectedItems).mockResolvedValueOnce(result([item('newer'), item('new'), item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await ctx.showPendingUpdates();
    expect(ctx.items().map(({ id }) => id)).toEqual(['newer', 'new', 'old']);
    expect(ctx.pendingUpdateLabel()).toBeNull();
  });

  it('fills an empty unread list after a local read action even with arrivals waiting', async () => {
    await mount();
    await ctx.setReadMode('unread');
    vi.mocked(listSelectedItems).mockResolvedValueOnce(result([item('new'), item('old')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await ctx.reloadItems(true);
    expect(ctx.pendingUpdateLabel()).toBe('Show 1 new');
    vi.mocked(listSelectedItems).mockResolvedValueOnce(result([item('new')]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await ctx.markReadAndSync(item('old'), true);
    expect(ctx.items().map(({ id }) => id)).toEqual(['new']);
    expect(ctx.pendingUpdateLabel()).toBeNull();
  });

  it('updates harmless metadata in place when membership and order are unchanged', async () => {
    await mount();
    vi.mocked(listSelectedItems).mockResolvedValueOnce(result([{ ...item('old'), title: 'Updated title' }]) as Awaited<ReturnType<typeof listSelectedItems>>);
    await ctx.reloadItems(true);
    expect(ctx.items().map(({ id }) => id)).toEqual(['old']);
    expect(ctx.items()[0].title).toBe('Updated title');
    expect(ctx.pendingUpdateLabel()).toBeNull();
  });
});
