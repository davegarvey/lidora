import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { Show, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { getDb } from '../src/db/open';
import { setStoredSyncKey } from '../src/sync/key';
import { ServerDataSection } from '../src/settings/ServerDataSection';
import { ConfirmModal } from '../src/components/ConfirmModal';
import type { AppContext, AppState } from '../src/state';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

const KEY = 'AbCdEfGhIjKlMnOpQrStUv';

let dispose: (() => void) | undefined;

function makeContext(key: string | null = KEY) {
  const [syncKey, setSyncKey] = createSignal<string | null>(key);
  const [state, setState] = createStore({ modal: { kind: 'none' } } as unknown as AppState);
  const disableSync = vi.fn(async () => { setSyncKey(null); });
  const regenerateSyncKey = vi.fn(async () => {});
  const selectSettingsSection = vi.fn();
  contextRef.value = {
    state,
    syncKey,
    disableSync,
    regenerateSyncKey,
    selectSettingsSection,
    openModal: (modal: AppState['modal']) => setState({ modal }),
    closeModal: () => setState({ modal: { kind: 'none' } }),
  } as unknown as AppContext;
  return { state, disableSync, regenerateSyncKey, selectSettingsSection };
}

function Harness() {
  const ctx = contextRef.value!;
  return (
    <>
      <ServerDataSection />
      <Show when={ctx.state.modal.kind === 'confirm'}>
        <ConfirmModal />
      </Show>
    </>
  );
}

async function mount() {
  document.body.innerHTML = '';
  dispose = render(() => <Harness />, document.body);
  await vi.waitFor(() => expect(document.querySelector('h2')?.textContent).toBe('Server data'));
}

const text = () => document.body.textContent ?? '';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string, root: Element | Document = document) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label);

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const agentsResponse = (count: number) =>
  new Response(JSON.stringify({ tokens: Array.from({ length: count }, (_, i) => ({ token_id: `t${i}`, label: null })) }), { status: 200 });

beforeEach(async () => {
  const db = await getDb();
  await db.clear('meta');
  await setStoredSyncKey(KEY);
  document.body.innerHTML = '';
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Server data', () => {
  it('shows what the server holds, the key ID without a copy action, and three actions', async () => {
    makeContext();
    stubFetch(() => agentsResponse(0));
    await mount();
    expect(text()).toContain('subscriptions, read and starred state, statistics and agent access');
    await vi.waitFor(() => expect(document.querySelector('.setting-value--code')?.textContent).toMatch(/^[0-9A-Z]{4}$/));
    expect(text()).toContain('Matches on every device in the same sync');
    expect(text()).not.toMatch(/copy/i);
    expect(button('Stop syncing')).toBeDefined();
    expect(button('Sign out')).toBeDefined();
    expect(button('Delete')?.classList.contains('danger-outline')).toBe(true);
    expect(button('Sign out')?.classList.contains('danger-outline')).toBe(false);
  });

  it('renders nothing without a sync key', async () => {
    makeContext(null);
    stubFetch(() => agentsResponse(0));
    document.body.innerHTML = '';
    dispose = render(() => <ServerDataSection />, document.body);
    await flush();
    expect(text()).not.toContain('Key ID');
    expect(button('Delete')).toBeUndefined();
  });

  it('confirms Stop syncing inline, then navigates to Devices and disables sync', async () => {
    const { disableSync, selectSettingsSection, state } = makeContext();
    stubFetch(() => agentsResponse(0));
    await mount();
    button('Stop syncing')!.click();
    await flush();
    const panel = document.querySelector('.panel--confirm')!;
    expect(panel.textContent).toContain('This device keeps its data and stops syncing');
    expect(panel.textContent).toContain('stays on the server');
    expect(panel.textContent).toContain('Delete data from the server');
    expect(panel.textContent).not.toContain('Agents will only see');
    expect(state.modal.kind).toBe('none');
    expect(disableSync).not.toHaveBeenCalled();
    button('Yes, stop syncing', panel)!.click();
    await vi.waitFor(() => expect(disableSync).toHaveBeenCalledTimes(1));
    expect(selectSettingsSection).toHaveBeenCalledWith('devices');
  });

  it('adds the agents sentence when agents are connected', async () => {
    makeContext();
    stubFetch(() => agentsResponse(2));
    await mount();
    await flush();
    button('Stop syncing')!.click();
    await vi.waitFor(() => expect(document.querySelector('.panel--confirm')?.textContent).toContain('Agents will only see changes made on other devices.'));
  });

  it('omits the agents sentence when the agent list cannot be read', async () => {
    makeContext();
    stubFetch(() => new Response(null, { status: 500 }));
    await mount();
    await flush();
    button('Stop syncing')!.click();
    await flush();
    expect(document.querySelector('.panel--confirm')?.textContent).not.toContain('Agents will only see');
  });

  it('asks for rotation in the dialog and reports success', async () => {
    const { regenerateSyncKey, state } = makeContext();
    stubFetch(() => agentsResponse(0));
    await mount();
    button('Sign out')!.click();
    await vi.waitFor(() => expect(document.querySelector('dialog[open]')).not.toBeNull());
    expect(state.modal.kind).toBe('confirm');
    const dialog = document.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Sign out other devices and agents');
    expect(dialog.textContent).toContain('agents lose access until you reconnect them');
    button('Sign out', dialog)!.click();
    await vi.waitFor(() => expect(regenerateSyncKey).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    expect(text()).toContain('Other devices and agents have been signed out.');
  });

  it('keeps the dialog open with an error when rotation fails', async () => {
    const { regenerateSyncKey } = makeContext();
    regenerateSyncKey.mockRejectedValue(new Error('Rotate failed: 500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => agentsResponse(0));
    await mount();
    button('Sign out')!.click();
    await flush();
    button('Sign out', document.querySelector('dialog')!)!.click();
    await vi.waitFor(() => expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain("Couldn't sign out other devices and agents"));
    expect(document.querySelector('dialog')).not.toBeNull();
  });

  it('deletes server data, then navigates to Devices and disables sync', async () => {
    const { disableSync, selectSettingsSection } = makeContext();
    const order: string[] = [];
    const fetchMock = stubFetch((url, init) => {
      if (url === '/sync/account') {
        order.push('delete');
        expect(init?.method).toBe('DELETE');
        expect(new Headers(init?.headers).get('X-Sync-Key')).toBe(KEY);
        return new Response(null, { status: 204 });
      }
      return agentsResponse(0);
    });
    disableSync.mockImplementation(async () => { order.push('disable'); });
    await mount();
    button('Delete')!.click();
    await flush();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Your other devices will stop syncing');
    expect(dialog.textContent).toContain('Reading data on this device is kept');
    expect(fetchMock.mock.calls.some((call) => call[0] === '/sync/account')).toBe(false);
    button('Delete', dialog)!.click();
    await vi.waitFor(() => expect(disableSync).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['delete', 'disable']);
    expect(selectSettingsSection).toHaveBeenCalledWith('devices');
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  });

  it('counts a 401 as a successful deletion', async () => {
    const { disableSync } = makeContext();
    stubFetch((url) => (url === '/sync/account' ? new Response(null, { status: 401 }) : agentsResponse(0)));
    await mount();
    button('Delete')!.click();
    await flush();
    button('Delete', document.querySelector('dialog')!)!.click();
    await vi.waitFor(() => expect(disableSync).toHaveBeenCalledTimes(1));
  });

  it('keeps sync on and the dialog open with the error when deletion fails', async () => {
    const { disableSync, selectSettingsSection } = makeContext();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch((url) => (url === '/sync/account' ? new Response(null, { status: 500 }) : agentsResponse(0)));
    await mount();
    button('Delete')!.click();
    await flush();
    const dialog = document.querySelector('dialog')!;
    button('Delete', dialog)!.click();
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')?.textContent).toBe("Couldn't delete the data from the server. Try again."));
    expect(disableSync).not.toHaveBeenCalled();
    expect(selectSettingsSection).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')).toBe(dialog);
    expect(button('Delete', dialog)!.disabled).toBe(false);
  });
});
