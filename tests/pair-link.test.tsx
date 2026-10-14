import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { AppProvider, useApp, type AppContext } from '../src/state';
import { getDb } from '../src/db/open';
import { resetSyncCapabilityCache } from '../src/sync/capabilities';

const KEY = 'AbCdEfGhIjKlMnOpQrStUv';

let ctx: AppContext;
let dispose: (() => void) | undefined;

function Probe() {
  ctx = useApp();
  return null;
}

function stubFetch(redeem: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/sync/capabilities') return new Response(JSON.stringify({ sync: true, stats: false, items: false }), { status: 200 });
    if (url === '/sync/redeem') return redeem();
    if (url.startsWith('/sync/pull')) return new Response(JSON.stringify({ serverTime: Date.now(), feeds: [], flags: [] }), { status: 200 });
    return new Response(JSON.stringify({}), { status: 200 });
  }));
}

async function mount(path: string) {
  history.replaceState(null, '', path);
  document.body.innerHTML = '';
  dispose = render(() => <AppProvider><Probe /></AppProvider>, document.body);
  await vi.waitFor(() => expect(ctx.hydrated()).toBe(true));
}

beforeEach(async () => {
  const db = await getDb();
  await db.clear('meta');
  resetSyncCapabilityCache();
  window.innerWidth = 1200;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('?pair= link', () => {
  it('opens Devices with the success result and removes the query', async () => {
    stubFetch(() => new Response(JSON.stringify({ syncKey: KEY }), { status: 200 }));
    await mount('/?pair=abcdefgh');
    expect(ctx.state.view).toBe('settings');
    expect(ctx.state.settingsPath).toBe('devices');
    expect(window.location.pathname).toBe('/settings/devices');
    expect(window.location.search).toBe('');
    expect(ctx.state.pairResult).toEqual({ kind: 'success' });
    expect(ctx.syncKey()).toBe(KEY);
  });

  it('opens Devices with the code and the error when the code cannot be redeemed', async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    await mount('/?pair=abcdefgh');
    expect(ctx.state.view).toBe('settings');
    expect(ctx.state.settingsPath).toBe('devices');
    expect(window.location.search).toBe('');
    expect(ctx.state.pairResult).toEqual({ kind: 'failure', code: 'abcdefgh', message: 'Code not found or expired' });
    expect(ctx.syncKey()).toBeNull();
  });

  it('rolls back to sync off when the first sync after pairing fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/sync/capabilities') return new Response(JSON.stringify({ sync: true }), { status: 200 });
      return new Response(null, { status: 403 });
    }));
    await mount('/');
    await expect(ctx.pairSyncWithKey(KEY)).rejects.toThrow();
    expect(ctx.syncKey()).toBeNull();
  });
});
