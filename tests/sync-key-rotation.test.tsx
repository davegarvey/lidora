import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { AppProvider, useApp, type AppContext } from '../src/state';
import { getDb } from '../src/db/open';
import { setMeta } from '../src/db/meta';
import { upsertFeed } from '../src/db/feeds';
import { resetSyncCapabilityCache } from '../src/sync/capabilities';
import { getPendingRotation, getStoredLastSyncAt, getStoredSyncKey } from '../src/sync/key';
import { pullNow } from '../src/sync/init';

const OLD_KEY = 'OldOldOldOldOldOldOld0';
const FEED_URL = 'https://example.com/feed.xml';

interface Call {
  url: string;
  method: string;
  key: string | null;
  body: string;
}

let ctx: AppContext;
let dispose: (() => void) | undefined;
let calls: Call[];
let rotate: (call: Call) => Response;
let tokens: (call: Call) => Response;

function Probe() {
  ctx = useApp();
  return null;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      key: new Headers(init?.headers).get('X-Sync-Key'),
      body: typeof init?.body === 'string' ? init.body : '',
    };
    calls.push(call);
    if (url === '/sync/capabilities') return json({ sync: true, stats: false, items: false });
    if (url === '/sync/rotate') return rotate(call);
    if (url === '/sync/tokens') return tokens(call);
    if (url.startsWith('/sync/pull')) return json({ serverTime: Date.now(), feeds: [], flags: [] });
    if (url === '/sync/push' || url === '/sync/register') return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  }));
}

const rotateCalls = () => calls.filter((c) => c.url === '/sync/rotate');
const rotatedTo = (c: Call) => (JSON.parse(c.body) as { sync_key: string }).sync_key;

async function mount() {
  document.body.innerHTML = '';
  dispose = render(() => <AppProvider><Probe /></AppProvider>, document.body);
  await vi.waitFor(() => expect(ctx.hydrated()).toBe(true));
  await vi.waitFor(() => expect(calls.some((c) => c.url.startsWith('/sync/pull'))).toBe(true));
}

beforeEach(async () => {
  const db = await getDb();
  await db.clear('meta');
  await db.clear('feeds');
  await setMeta('settings', { syncKey: OLD_KEY, lastSyncAt: 1 });
  await upsertFeed({ id: FEED_URL, url: FEED_URL, title: 'Example', learnedIntervalMs: 3_600_000, lastFetched: Date.now() });
  resetSyncCapabilityCache();
  calls = [];
  rotate = () => new Response(null, { status: 204 });
  tokens = () => json({ tokens: [] });
  window.innerWidth = 1200;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubFetch();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sync key rotation', () => {
  it('keeps the old key when the server rejects the rotation, then retries with the same pair', async () => {
    rotate = () => new Response(null, { status: 500 });
    await mount();

    await expect(ctx.regenerateSyncKey()).rejects.toThrow();
    expect(await getStoredSyncKey()).toBe(OLD_KEY);
    expect(ctx.syncKey()).toBe(OLD_KEY);
    const first = rotateCalls()[0];
    expect(first.key).toBe(OLD_KEY);
    expect(await getPendingRotation()).toEqual({ oldKey: OLD_KEY, newKey: rotatedTo(first) });

    rotate = () => new Response(null, { status: 204 });
    await ctx.regenerateSyncKey();
    const second = rotateCalls()[1];
    expect(second.key).toBe(OLD_KEY);
    expect(rotatedTo(second)).toBe(rotatedTo(first));
    expect(ctx.syncKey()).toBe(rotatedTo(first));
    expect(await getPendingRotation()).toBeNull();
  });

  it('completes a rotation the server committed when the new key is live', async () => {
    rotate = () => new Response(null, { status: 401 });
    await mount();

    await ctx.regenerateSyncKey();
    const newKey = rotatedTo(rotateCalls()[0]);
    expect(calls.find((c) => c.url === '/sync/tokens')?.key).toBe(newKey);
    expect(ctx.syncKey()).toBe(newKey);
  });

  it('fails when the old key is rejected and the new key is not live', async () => {
    rotate = () => new Response(null, { status: 401 });
    tokens = () => new Response(null, { status: 401 });
    await mount();

    await expect(ctx.regenerateSyncKey()).rejects.toThrow();
    expect(await getStoredSyncKey()).toBe(OLD_KEY);
  });

  it('uploads the local library to the new account without registering it', async () => {
    await mount();
    const before = calls.length;

    await ctx.regenerateSyncKey();
    const newKey = ctx.syncKey()!;
    expect(newKey).not.toBe(OLD_KEY);
    const after = calls.slice(before);
    expect(after.some((c) => c.url === '/sync/pull?since=0' && c.key === newKey)).toBe(true);
    expect(after.some((c) => c.url === '/sync/push' && c.key === newKey && c.body.includes(FEED_URL))).toBe(true);
    expect(after.some((c) => c.url === '/sync/register')).toBe(false);
    expect(await getStoredLastSyncAt()).not.toBeNull();
  });

  it('finishes the upload on the next pull when it failed after rotation', async () => {
    await mount();
    let failPull = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const call: Call = { url, method: init?.method ?? 'GET', key: new Headers(init?.headers).get('X-Sync-Key'), body: typeof init?.body === 'string' ? init.body : '' };
      calls.push(call);
      if (url === '/sync/capabilities') return json({ sync: true, stats: false, items: false });
      if (url === '/sync/rotate') return new Response(null, { status: 204 });
      if (url.startsWith('/sync/pull')) return failPull ? new Response(null, { status: 500 }) : json({ serverTime: Date.now(), feeds: [], flags: [] });
      return new Response(null, { status: 204 });
    }));

    await ctx.regenerateSyncKey();
    const newKey = ctx.syncKey()!;
    expect(await getStoredLastSyncAt()).toBeNull();

    failPull = false;
    const before = calls.length;
    await pullNow();
    const after = calls.slice(before);
    expect(after.some((c) => c.url === '/sync/push' && c.key === newKey && c.body.includes(FEED_URL))).toBe(true);
    expect(after.some((c) => c.url === '/sync/register')).toBe(false);
    expect(await getStoredLastSyncAt()).not.toBeNull();
  });

  it('clears a pending rotation when sync is turned off', async () => {
    rotate = () => new Response(null, { status: 500 });
    await mount();
    await expect(ctx.regenerateSyncKey()).rejects.toThrow();
    expect(await getPendingRotation()).not.toBeNull();

    await ctx.disableSync();
    expect(await getPendingRotation()).toBeNull();
  });
});
