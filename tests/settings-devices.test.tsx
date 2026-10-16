import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { getDb } from '../src/db/open';
import { setStoredSyncKey } from '../src/sync/key';
import { DevicesSection } from '../src/settings/DevicesSection';
import { markError, resetSyncStatus } from '../src/sync/status';
import { KEY_REJECTED_MESSAGE, SyncClientError } from '../src/sync/client';
import type { AppContext, AppState, PairResult } from '../src/state';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));
const capsRef = vi.hoisted(() => ({ items: false }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

vi.mock('../src/sync/capabilities', () => ({
  getSyncCapabilities: async () => ({ sync: true, stats: true, items: capsRef.items }),
}));

const KEY = 'AbCdEfGhIjKlMnOpQrStUv';
const OTHER_KEY = 'ZyXwVuTsRqPoNmLkJiHgFe';

let dispose: (() => void) | undefined;

function makeContext(options: { key?: string | null; pairResult?: PairResult | null; enableFails?: boolean } = {}) {
  const [key, setKey] = createSignal<string | null>(options.key ?? null);
  const [state, setState] = createStore({ pairResult: options.pairResult ?? null } as unknown as AppState);
  const enableSync = vi.fn(async () => {
    if (options.enableFails) throw new Error('boom');
    await setStoredSyncKey(KEY);
    setKey(KEY);
  });
  const pairSyncWithKey = vi.fn(async (next: string) => {
    await setStoredSyncKey(next);
    setKey(next);
  });
  const selectSettingsSection = vi.fn();
  const syncNow = vi.fn(async () => {});
  contextRef.value = {
    state,
    setState,
    syncKey: key,
    enableSync,
    pairSyncWithKey,
    selectSettingsSection,
    syncNow,
  } as unknown as AppContext;
  return { enableSync, pairSyncWithKey, selectSettingsSection, syncNow, key, state };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = () => document.body.textContent ?? '';
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);

async function mount() {
  document.body.innerHTML = '';
  dispose = render(() => <DevicesSection />, document.body);
  await vi.waitFor(() => expect(document.querySelector('.device-card')).not.toBeNull());
}

function setValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function otpResponse(code = 'abcdefgh', ttl = 300_000) {
  return new Response(JSON.stringify({ code, expiresAt: Date.now() + ttl }), { status: 200 });
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const mock = vi.fn(async (...args: [string, RequestInit?]) => handler(args[0]));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

const callsTo = (mock: ReturnType<typeof stubFetch>, path: string) => mock.mock.calls.filter((call) => call[0] === path).length;

beforeEach(async () => {
  capsRef.items = false;
  const db = await getDb();
  await db.clear('meta');
  resetSyncStatus();
  document.body.innerHTML = '';
  window.innerWidth = 1200;
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Devices: sync off', () => {
  it('shows the explanation, both cards and no switch, without calling the server', async () => {
    makeContext();
    const fetchMock = stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(text()).toContain('Keep your subscriptions and reading progress in step across your devices.');
    expect(text()).toContain('Add a device');
    expect(text()).toContain('Join from another device');
    expect(document.querySelector('label[for]')?.textContent).toBe('Pairing code');
    expect(document.querySelector('[role="switch"]')).toBeNull();
    expect(document.querySelector('.device-cards--pair')).not.toBeNull();
    expect(text()).not.toContain('Collect new posts');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers collecting posts only when the server reports items', async () => {
    capsRef.items = true;
    const { enableSync } = makeContext();
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(text()).toContain('Collect new posts while Lidora is closed');
    expect(text()).toContain('stores your subscriptions on this Lidora server');
    button('Turn on')!.click();
    await vi.waitFor(() => expect(enableSync).toHaveBeenCalledTimes(1));
  });

  it('shows a retry when collecting posts cannot turn sync on', async () => {
    capsRef.items = true;
    makeContext({ enableFails: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    button('Turn on')!.click();
    await vi.waitFor(() => expect(text()).toContain("Couldn't turn on sync"));
    expect(button('Retry')).toBeDefined();
  });

  it('disables Scan with a visible reason when there is no camera', async () => {
    makeContext();
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    const scan = button('Scan a QR code')!;
    await vi.waitFor(() => expect(text()).toContain('No camera found'));
    expect(scan.disabled).toBe(true);
  });
});

describe('Devices: sync on', () => {
  beforeEach(async () => {
    await setStoredSyncKey(KEY);
  });

  it('shows the status card, a collapsed Add a device card and no code request', async () => {
    makeContext({ key: KEY });
    const fetchMock = stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(text()).toContain('Never synced');
    expect(button('Sync now')).toBeDefined();
    expect(button('Show pairing code')!.getAttribute('aria-expanded')).toBe('false');
    expect(button('Join a different sync instead')).toBeDefined();
    expect(document.querySelector('[role="switch"]')).toBeNull();
    expect(callsTo(fetchMock, '/sync/otp')).toBe(0);
  });

  it('shows the full error text and the rejected-key link', async () => {
    const { selectSettingsSection } = makeContext({ key: KEY });
    markError('pull', new SyncClientError(KEY_REJECTED_MESSAGE, 401));
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(text()).toMatch(/Sync failed/);
    expect(text()).toContain('Join from another device again, or stop syncing on this device.');
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Open Server data')!;
    link.click();
    expect(selectSettingsSection).toHaveBeenCalledWith('server-data');
  });

  it('runs Sync now', async () => {
    const { syncNow } = makeContext({ key: KEY });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    button('Sync now')!.click();
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
  });

  it('expands the join card with a warning from the Join a different sync link', async () => {
    makeContext({ key: KEY });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    button('Join a different sync instead')!.click();
    await flush();
    expect(text()).toContain('this device leaves its current one');
    expect(document.querySelector('input')).not.toBeNull();
  });

  it('issues a code only when the card is expanded, and shows it with a countdown', async () => {
    makeContext({ key: KEY });
    const fetchMock = stubFetch((url) => (url === '/sync/otp' ? otpResponse() : new Response(null, { status: 500 })));
    await mount();
    await flush();
    expect(callsTo(fetchMock, '/sync/otp')).toBe(0);
    button('Show pairing code')!.click();
    await vi.waitFor(() => expect(text()).toContain('abcd-efgh'));
    expect(callsTo(fetchMock, '/sync/otp')).toBe(1);
    expect(text()).toMatch(/Expires in [45]:\d\d/);
    expect(text()).toContain('Waiting for another device to pair…');
    expect(document.querySelector('.pair-code__qr svg')).not.toBeNull();
    expect(button('Copy pairing code')).toBeDefined();
  });

  it('announces the code and the copy, and reports a failed copy', async () => {
    makeContext({ key: KEY });
    stubFetch((url) => (url === '/sync/otp' ? otpResponse() : new Response(null, { status: 500 })));
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await mount();
    button('Show pairing code')!.click();
    const status = () => document.querySelector('.pair-code [role="status"]')?.textContent;
    await vi.waitFor(() => expect(status()).toBe('Pairing code abcd-efgh'));
    button('Copy pairing code')!.click();
    await vi.waitFor(() => expect(status()).toBe('Pairing code copied'));
    expect(writeText).toHaveBeenCalledWith('abcdefgh');

    writeText.mockRejectedValue(new Error('denied'));
    button('Copy pairing code')!.click();
    await vi.waitFor(() => expect(document.querySelector('.pair-code [role="alert"]')?.textContent).toBe("Couldn't copy the code. Select it and copy it yourself."));
  });

  it('refreshes the code while open and stops when collapsed', async () => {
    makeContext({ key: KEY });
    let issued = 0;
    const fetchMock = stubFetch((url) => {
      if (url !== '/sync/otp') return new Response(null, { status: 500 });
      issued += 1;
      return otpResponse(issued === 1 ? 'abcdefgh' : 'jkmnpqrs', 3000);
    });
    await mount();
    fakeTimers();
    button('Show pairing code')!.click();
    await vi.waitFor(() => expect(text()).toContain('abcd-efgh'));
    await vi.advanceTimersByTimeAsync(3500);
    await vi.waitFor(() => expect(text()).toContain('jkmn-pqrs'));
    expect(callsTo(fetchMock, '/sync/otp')).toBe(2);

    button('Hide code')!.click();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(callsTo(fetchMock, '/sync/otp')).toBe(2);
    expect(document.querySelector('.pair-code')).toBeNull();
  });

  it('keeps the previous code and offers Retry when a refresh fails', async () => {
    makeContext({ key: KEY });
    let fail = false;
    stubFetch((url) => {
      if (url !== '/sync/otp') return new Response(null, { status: 500 });
      return fail ? new Response(null, { status: 500 }) : otpResponse('abcdefgh', 3000);
    });
    await mount();
    fakeTimers();
    button('Show pairing code')!.click();
    await vi.waitFor(() => expect(text()).toContain('abcd-efgh'));
    fail = true;
    await vi.advanceTimersByTimeAsync(3500);
    await vi.waitFor(() => expect(text()).toContain('Could not get a new code'));
    expect(text()).toContain('abcd-efgh');
    fail = false;
    button('Retry')!.click();
    await vi.waitFor(() => expect(text()).not.toContain('Could not get a new code'));
    expect(text()).toContain('abcd-efgh');
  });
});

describe('Devices: Add a device with sync off', () => {
  it('turns sync on, then issues a code', async () => {
    const { enableSync } = makeContext();
    const fetchMock = stubFetch((url) => (url === '/sync/otp' ? otpResponse() : new Response(null, { status: 500 })));
    await mount();
    expect(callsTo(fetchMock, '/sync/otp')).toBe(0);
    button('Show pairing code')!.click();
    await vi.waitFor(() => expect(text()).toContain('abcd-efgh'));
    expect(enableSync).toHaveBeenCalledTimes(1);
    expect(callsTo(fetchMock, '/sync/otp')).toBe(1);
    expect(document.querySelector('.device-cards--pair')).toBeNull();
  });

  it('shows Couldn\'t turn on sync with Retry and issues no code when enabling fails', async () => {
    const { enableSync } = makeContext({ enableFails: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = stubFetch(() => otpResponse());
    await mount();
    button('Show pairing code')!.click();
    await vi.waitFor(() => expect(text()).toContain("Couldn't turn on sync"));
    expect(callsTo(fetchMock, '/sync/otp')).toBe(0);
    button('Retry')!.click();
    await vi.waitFor(() => expect(enableSync).toHaveBeenCalledTimes(2));
  });
});

describe('Devices: join card', () => {
  it('rejects an invalid value without calling the server and keeps it', async () => {
    const { pairSyncWithKey } = makeContext();
    const fetchMock = stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    const input = document.querySelector<HTMLInputElement>('input')!;
    setValue(input, 'nope');
    button('Pair')!.click();
    await flush();
    expect(text()).toContain('Enter an 8-character code or a 22-character sync key');
    expect(input.value).toBe('nope');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pairSyncWithKey).not.toHaveBeenCalled();
  });

  it('redeems a code in any case, with or without the dash, and switches to sync on in place', async () => {
    const { pairSyncWithKey, key } = makeContext();
    const fetchMock = stubFetch((url) => (url === '/sync/redeem' ? new Response(JSON.stringify({ syncKey: OTHER_KEY }), { status: 200 }) : new Response(null, { status: 500 })));
    await mount();
    setValue(document.querySelector<HTMLInputElement>('input')!, 'ABCD-EFGH');
    button('Pair')!.click();
    await vi.waitFor(() => expect(text()).toContain('This device is now syncing'));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as unknown as RequestInit).body as string) as { code: string };
    expect(body.code).toBe('abcdefgh');
    expect(pairSyncWithKey).toHaveBeenCalledWith(OTHER_KEY);
    expect(key()).toBe(OTHER_KEY);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('This device is now syncing');
    expect(button('Sync now')).toBeDefined();
  });

  it('pairs with a 22-character key without a server call', async () => {
    const { pairSyncWithKey } = makeContext();
    const fetchMock = stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    setValue(document.querySelector<HTMLInputElement>('input')!, OTHER_KEY);
    button('Pair')!.click();
    await vi.waitFor(() => expect(text()).toContain('This device is now syncing'));
    expect(pairSyncWithKey).toHaveBeenCalledWith(OTHER_KEY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses the key already in use', async () => {
    await setStoredSyncKey(KEY);
    const { pairSyncWithKey } = makeContext({ key: KEY });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    button('Join a different sync instead')!.click();
    await flush();
    setValue(document.querySelector<HTMLInputElement>('.join-form input')!, KEY);
    button('Pair')!.click();
    await flush();
    expect(text()).toContain('Already paired with this key');
    expect(pairSyncWithKey).not.toHaveBeenCalled();
  });

  it('shows a redeem failure under the input and keeps the value', async () => {
    makeContext();
    stubFetch(() => new Response(null, { status: 404 }));
    await mount();
    const input = document.querySelector<HTMLInputElement>('input')!;
    setValue(input, 'abcdefgh');
    button('Pair')!.click();
    await vi.waitFor(() => expect(text()).toContain('Code not found or expired'));
    expect(input.value).toBe('abcdefgh');
    expect(document.querySelector('.join-form [role="alert"]')).not.toBeNull();
  });

  it('shows a first sync failure under the input and stays in the sync-off layout', async () => {
    const { pairSyncWithKey } = makeContext();
    pairSyncWithKey.mockImplementation(async () => { throw new Error('Pull failed: 500'); });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    setValue(document.querySelector<HTMLInputElement>('input')!, OTHER_KEY);
    button('Pair')!.click();
    await vi.waitFor(() => expect(text()).toContain('Pull failed: 500'));
    expect(document.querySelector<HTMLInputElement>('input')!.value).toBe(OTHER_KEY);
    expect(document.querySelector('.device-cards--pair')).not.toBeNull();
  });
});

describe('Devices: pair link results', () => {
  it('shows the success status', async () => {
    await setStoredSyncKey(KEY);
    const { state } = makeContext({ key: KEY, pairResult: { kind: 'success' } });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(document.querySelector('[role="status"]')?.textContent).toBe('This device is now syncing');
    expect(state.pairResult).toBeNull();
  });

  it('expands the join card with the code filled in and the error shown when sync is off', async () => {
    makeContext({ pairResult: { kind: 'failure', code: 'abcdefgh', message: 'Code not found or expired' } });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('abcdefgh');
    expect(text()).toContain('Code not found or expired');
  });

  it('expands the join panel when sync is already on', async () => {
    await setStoredSyncKey(KEY);
    makeContext({ key: KEY, pairResult: { kind: 'failure', code: 'abcdefgh', message: 'Code not found or expired' } });
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    await flush();
    expect(button('Join a different sync instead')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLInputElement>('.join-form input')!.value).toBe('abcdefgh');
    expect(text()).toContain('Code not found or expired');
  });

  it('asks before a pair link switches an active sync, and pairs only on Pair', async () => {
    await setStoredSyncKey(KEY);
    const { pairSyncWithKey, state } = makeContext({ key: KEY, pairResult: { kind: 'confirm', code: 'abcdefgh' } });
    const fetchMock = stubFetch((url) => (url === '/sync/redeem' ? new Response(JSON.stringify({ syncKey: OTHER_KEY }), { status: 200 }) : new Response(null, { status: 500 })));
    await mount();
    await flush();
    expect(state.pairResult).toBeNull();
    expect(button('Join a different sync instead')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLInputElement>('.join-form input')!.value).toBe('abcdefgh');
    expect(text()).toContain('Joining another sync means this device leaves its current one.');
    expect(document.querySelector('.join-form [role="alert"]')).toBeNull();
    expect(callsTo(fetchMock, '/sync/redeem')).toBe(0);
    expect(pairSyncWithKey).not.toHaveBeenCalled();

    button('Pair')!.click();
    await vi.waitFor(() => expect(pairSyncWithKey).toHaveBeenCalledWith(OTHER_KEY));
    expect(callsTo(fetchMock, '/sync/redeem')).toBe(1);
  });
});
