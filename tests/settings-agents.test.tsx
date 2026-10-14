import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { getDb } from '../src/db/open';
import { setStoredSyncKey } from '../src/sync/key';
import { agentSetupPrompt } from '../src/agents/setupPrompt';
import { AgentsSection } from '../src/settings/AgentsSection';
import type { AppContext } from '../src/state';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

vi.mock('../src/sync/capabilities', () => ({
  isSyncAvailable: async () => true,
}));

const KEY = 'AbCdEfGhIjKlMnOpQrStUv';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

const token = {
  token_id: 't1',
  fingerprint: 'AB12',
  label: null as string | null,
  client_name: 'Test Agent' as string | null,
  client_host: 'client.example' as string | null,
  unverified: true,
  scopes: 'read write',
  created_at: Date.now() - 3 * 86_400_000,
  last_seen_at: null as number | null,
};

const pendingView = {
  status: 'pending',
  clientName: 'Approve Me',
  unverified: true,
  clientHost: null,
  redirectHost: 'cursor://',
  scopes: ['read'],
  createdAt: Date.now(),
  expiresAt: Date.now() + 600_000,
};

let calls: Call[];
let tokens: Array<typeof token>;
let listStatus: number;
let writeStatus: number;
let mintExpiresIn: number;
let writeText: ReturnType<typeof vi.fn>;
let dispose: (() => void) | undefined;
let enableSync: ReturnType<typeof vi.fn>;

function respond(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

function setContext(options: { key: string | null; enableFails?: boolean }) {
  const [key, setKey] = createSignal<string | null>(options.key);
  enableSync = vi.fn(async () => {
    if (options.enableFails) throw new Error('boom');
    await setStoredSyncKey(KEY);
    setKey(KEY);
  });
  contextRef.value = { syncKey: key, enableSync } as unknown as AppContext;
}

beforeEach(async () => {
  calls = [];
  tokens = [];
  listStatus = 200;
  writeStatus = 204;
  mintExpiresIn = 600_000;
  writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText }, mediaDevices: undefined });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = {
        url,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? init.body : null,
      };
      calls.push(call);
      if (url === '/sync/connections') return respond({ connectionId: 'c1', url: 'https://sift.example/mcp/c/c1', expiresAt: Date.now() + mintExpiresIn });
      if (url === '/sync/tokens' && call.method === 'GET') return listStatus === 200 ? respond({ tokens }) : respond({}, listStatus);
      if (url === '/sync/tokens') return writeStatus === 204 ? respond(null, 204) : respond({}, writeStatus);
      if (url === '/oauth/approvals/abcd2345') return respond(pendingView);
      if (url === '/oauth/approvals/abcd2345/decision') return respond({ status: 'approved' });
      if (url.startsWith('/oauth/approvals/')) return respond({ error: 'not_found' }, 404);
      return respond({}, 404);
    }),
  );
  const db = await getDb();
  await db.clear('meta');
  await setStoredSyncKey(KEY);
  setContext({ key: KEY });
  document.body.innerHTML = '';
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = () => document.body.textContent ?? '';

async function mount() {
  dispose = render(() => <AgentsSection />, document.body);
  await vi.waitFor(() => expect(text()).toContain('Connected agents'));
  await vi.waitFor(() => expect(text()).not.toContain('Loading agents'));
  await flush();
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.includes(label) || b.getAttribute('aria-label')?.includes(label),
  );
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

describe('Agents section', () => {
  it('shows the explanation, connect action and quiet approval disclosure', async () => {
    await mount();
    expect(text()).toContain('Let an AI assistant read and manage your feeds through MCP.');
    expect(text()).toContain('Connect an agent');
    expect(text()).toContain('Have an approval code?');
    expect(text()).not.toContain('Agents use the copy of your subscriptions');
    expect(text()).not.toContain('siftctl');
    expect(text()).not.toContain('/mcp');
    expect(text().toLowerCase()).not.toContain('sync key');
    expect(document.querySelector('a[href="/openapi.json"]')).toBeNull();
    expect(button('Have an approval code?').getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('input[aria-label="Approval code"]')).toBeNull();
    expect(document.querySelector('h3')?.textContent).toBe('Connected agents');
  });

  it('shows the sync-off note and turns sync on before minting a link', async () => {
    setContext({ key: null });
    await mount();
    expect(text()).toContain('Connecting one turns this on.');
    expect(text()).toContain('No agents connected');
    expect(calls.some((c) => c.url === '/sync/tokens')).toBe(false);
    button('Connect an agent').click();
    await vi.waitFor(() => expect(text()).toContain('https://sift.example/mcp/c/c1'));
    expect(enableSync).toHaveBeenCalledTimes(1);
    expect(calls.findIndex((c) => c.url === '/sync/connections')).toBeGreaterThan(-1);
    expect(text()).not.toContain('Connecting one turns this on.');
  });

  it('shows an error and mints nothing when turning sync on fails', async () => {
    setContext({ key: null, enableFails: true });
    await mount();
    button('Connect an agent').click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't turn on sync"));
    expect(calls.some((c) => c.url === '/sync/connections')).toBe(false);
    expect(text()).toContain('Connecting one turns this on.');
    expect(button('Connect an agent').disabled).toBe(false);
  });

  it('mints a link, copies the instructions and announces it in its own status line', async () => {
    await mount();
    button('Connect an agent').click();
    await vi.waitFor(() => expect(text()).toContain('https://sift.example/mcp/c/c1'));
    expect(writeText).toHaveBeenCalledWith(agentSetupPrompt('https://sift.example/mcp/c/c1'));
    const mint = calls.find((c) => c.url === '/sync/connections');
    expect(mint?.method).toBe('POST');
    expect(mint?.headers['X-Sync-Key']).toBe(KEY);
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toBe('Setup instructions copied');
    expect(status?.querySelector('svg')).not.toBeNull();
    expect(text()).toContain("Paste the setup instructions into your agent's chat, or the link into its connector settings, then tap Allow. Expires in 10 min.");
    button('Copy setup instructions').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it('says the link has expired above Create a new link', async () => {
    mintExpiresIn = 1100;
    await mount();
    button('Connect an agent').click();
    await vi.waitFor(() => expect(text()).toContain('https://sift.example/mcp/c/c1'));
    await vi.waitFor(() => expect(text()).toContain('This link has expired'), { timeout: 4000 });
    expect(text()).not.toContain('https://sift.example/mcp/c/c1');
    const note = [...document.querySelectorAll('p')].find((p) => p.textContent === 'This link has expired')!;
    const create = button('Create a new link');
    expect(note.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a loading line, then an empty state', async () => {
    let release: (() => void) | undefined;
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/sync/tokens' && (init?.method ?? 'GET') === 'GET') {
        await new Promise<void>((resolve) => { release = resolve; });
      }
      return original(url, init);
    }));
    dispose = render(() => <AgentsSection />, document.body);
    await vi.waitFor(() => expect(text()).toContain('Loading agents'));
    expect(text()).not.toContain('No agents connected');
    release?.();
    await vi.waitFor(() => expect(text()).toContain('No agents connected'));
    expect(text()).not.toContain('Loading agents');
  });

  it('shows a load error with Retry instead of an empty list', async () => {
    listStatus = 500;
    await mount();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load'));
    expect(text()).not.toContain('No agents connected');
    listStatus = 200;
    tokens = [{ ...token }];
    button('Retry').click();
    await vi.waitFor(() => expect(text()).toContain('Test Agent'));
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the agent identity rules', async () => {
    tokens = [{ ...token, label: 'Work laptop', unverified: false, scopes: 'read', last_seen_at: Date.now() - 2 * 3_600_000 }];
    await mount();
    await vi.waitFor(() => expect(text()).toContain('Work laptop'));
    expect(document.querySelector('.agent-row__detail')?.textContent).toBe('Test Agent · Read only · Last used 2h ago');
  });

  it('names an agent without a client name generically and marks unverified ones', async () => {
    tokens = [{ ...token, client_name: null, client_host: null, unverified: false }];
    await mount();
    await vi.waitFor(() => expect(document.querySelector('.agent-row__title')?.textContent).toBe('Agent'));
    dispose?.();
    document.body.innerHTML = '';
    tokens = [{ ...token }];
    await mount();
    await vi.waitFor(() => expect(document.querySelector('.agent-row__title')?.textContent).toContain('unverified'));
    expect(document.querySelector('.agent-row__detail')?.textContent).toBe('client.example · Not used yet');
    expect(text()).not.toContain('AB12');
  });

  it('renames an agent and restores the default with an empty value', async () => {
    tokens = [{ ...token }];
    await mount();
    await vi.waitFor(() => expect(text()).toContain('Test Agent'));
    button('Rename Test Agent').click();
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Agent name"]')!;
    expect(input.maxLength).toBe(64);
    typeInto(input, '  Work laptop ');
    tokens = [{ ...token, label: 'Work laptop' }];
    button('Save name').click();
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body ?? '{}')).toEqual({ tokenId: 't1', label: 'Work laptop' });
    await vi.waitFor(() => expect(text()).toContain('Work laptop'));
    button('Rename Work laptop').click();
    typeInto(document.querySelector<HTMLInputElement>('input[aria-label="Agent name"]')!, '');
    button('Save name').click();
    await vi.waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
    expect(JSON.parse(calls.filter((c) => c.method === 'PATCH')[1].body ?? '{}')).toEqual({ tokenId: 't1', label: '' });
  });

  it('reports a failed rename next to the list and keeps the editor open', async () => {
    tokens = [{ ...token }];
    await mount();
    await vi.waitFor(() => expect(text()).toContain('Test Agent'));
    writeStatus = 500;
    button('Rename Test Agent').click();
    typeInto(document.querySelector<HTMLInputElement>('input[aria-label="Agent name"]')!, 'New name');
    button('Save name').click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Could not rename. Try again.'));
    expect(document.querySelector('input[aria-label="Agent name"]')).not.toBeNull();
  });

  it('confirms a revoke inside the agent row and reloads the list', async () => {
    tokens = [{ ...token, label: 'Work laptop' }];
    await mount();
    await vi.waitFor(() => expect(text()).toContain('Work laptop'));
    button('Revoke Work laptop').click();
    await vi.waitFor(() => expect(text()).toContain('Revoke access for Work laptop? It loses access immediately and can be connected again later.'));
    expect(document.querySelector('.agent-row .panel--confirm')).not.toBeNull();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    tokens = [];
    button('Yes, revoke').click();
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === 'DELETE')!.body ?? '{}')).toEqual({ token_id: 't1' });
    await vi.waitFor(() => expect(text()).toContain('No agents connected'));
    expect(text()).not.toContain('Work laptop');
  });

  it('keeps the revoke confirmation open with the error when revoking fails', async () => {
    tokens = [{ ...token, label: 'Work laptop' }];
    await mount();
    await vi.waitFor(() => expect(text()).toContain('Work laptop'));
    writeStatus = 500;
    button('Revoke Work laptop').click();
    button('Yes, revoke').click();
    await vi.waitFor(() => expect(document.querySelector('.panel--confirm [role="alert"]')?.textContent).toContain('Could not revoke'));
    expect(text()).toContain('Yes, revoke');
    expect(text()).toContain('Work laptop');
    expect(document.querySelector('.panel--confirm')?.hasAttribute('hidden')).toBe(false);
  });

  it('opens the approval-code disclosure and ignores case, spaces and hyphens', async () => {
    await mount();
    button('Have an approval code?').click();
    expect(button('Have an approval code?').getAttribute('aria-expanded')).toBe('true');
    typeInto(document.querySelector<HTMLInputElement>('input[aria-label="Approval code"]')!, ' ABCD-23 45 ');
    button('Look up').click();
    await vi.waitFor(() => expect(text()).toContain('Approve Me'));
    expect(calls.find((c) => c.url === '/oauth/approvals/abcd2345')?.headers['X-Sync-Key']).toBe(KEY);
    expect(text()).toContain('cursor://');
    expect(text()).toContain('It cannot change anything');
    expect(enableSync).not.toHaveBeenCalled();
    button('Approve').click();
    await vi.waitFor(() => expect(text()).toContain('Approve Me is now connected.'));
    const decision = calls.find((c) => c.url === '/oauth/approvals/abcd2345/decision');
    expect(JSON.parse(decision?.body ?? '{}')).toEqual({ decision: 'approve' });
  });

  it('turns sync on before looking up and approving a code when there is no key', async () => {
    const db = await getDb();
    await db.clear('meta');
    setContext({ key: null });
    await mount();
    button('Have an approval code?').click();
    typeInto(document.querySelector<HTMLInputElement>('input[aria-label="Approval code"]')!, 'abcd2345');
    button('Look up').click();
    await vi.waitFor(() => expect(text()).toContain('Approve Me'));
    expect(enableSync).toHaveBeenCalledTimes(1);
    button('Approve').click();
    await vi.waitFor(() => expect(text()).toContain('Approve Me is now connected.'));
    expect(calls.find((c) => c.url === '/oauth/approvals/abcd2345')?.headers['X-Sync-Key']).toBe(KEY);
  });

  it('reports an unknown code', async () => {
    await mount();
    button('Have an approval code?').click();
    typeInto(document.querySelector<HTMLInputElement>('input[aria-label="Approval code"]')!, 'zzzzzzzz');
    button('Look up').click();
    await vi.waitFor(() => expect(text()).toContain('No request matches that code'));
  });
});
