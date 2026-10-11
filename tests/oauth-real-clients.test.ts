import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openNodeSqlite } from '../server/node-sqlite';
import { createSelfHostedDatabases } from '../server/sqlite-d1';
import { createApp } from '../server/handle';
import { fetchUpstreamWithPolicy } from '../server/fetch';

vi.mock('../server/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/fetch')>()),
  fetchUpstreamWithPolicy: vi.fn(),
}));

const ORIGIN = 'http://localhost';
const KEY = 'oauthtestkey0000000003';

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'oauth-clients', name), 'utf8')) as Record<string, unknown>;
}

const CODEX = fixture('codex.json');
const CHATGPT = fixture('chatgpt.json');

const directories: string[] = [];
let app: ReturnType<typeof createApp>;
let close: () => void;

function serveDocuments(docs: Record<string, unknown>): void {
  vi.mocked(fetchUpstreamWithPolicy).mockImplementation(async (url) => {
    const doc = docs[String(url)];
    if (doc === undefined) return new Response('not found', { status: 404 });
    return new Response(typeof doc === 'string' ? doc : JSON.stringify(doc), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

beforeEach(async () => {
  vi.mocked(fetchUpstreamWithPolicy).mockReset();
  serveDocuments({ [CODEX.client_id as string]: CODEX, [CHATGPT.client_id as string]: CHATGPT });
  const directory = mkdtempSync(join(tmpdir(), 'sift-oauth-real-'));
  directories.push(directory);
  const databases = await createSelfHostedDatabases(directory, openNodeSqlite);
  close = () => {
    databases.sync.connection.close?.();
    databases.poll.connection.close?.();
  };
  app = createApp({ db: databases.sync as unknown as D1Database });
  expect((await app.request('/sync/register', { method: 'POST', headers: { 'X-Sync-Key': KEY } })).status).toBe(204);
});

afterEach(() => {
  close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

async function mintConnection(): Promise<{ connectionId: string; url: string }> {
  const res = await app.request('/sync/connections', { method: 'POST', headers: { 'X-Sync-Key': KEY } });
  expect(res.status).toBe(200);
  return (await res.json()) as { connectionId: string; url: string };
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
}

async function tokenRequest(path: string, params: Record<string, string>): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
}

async function discover(connectionId: string, connectionUrl: string): Promise<{ authorize: string; token: string }> {
  const resource = (await (await app.request(`/.well-known/oauth-protected-resource/mcp/c/${connectionId}`)).json()) as {
    resource: string;
    authorization_servers: string[];
  };
  expect(resource.resource).toBe(connectionUrl);
  const issuer = new URL(resource.authorization_servers[0]);
  const meta = (await (await app.request(`/.well-known/oauth-authorization-server${issuer.pathname}`)).json()) as Record<string, unknown>;
  expect(meta.issuer).toBe(resource.authorization_servers[0]);
  expect(meta.code_challenge_methods_supported).toEqual(['S256']);
  expect(meta.token_endpoint_auth_methods_supported).toEqual(['none']);
  expect(meta.client_id_metadata_document_supported).toBe(true);
  return {
    authorize: new URL(meta.authorization_endpoint as string).pathname,
    token: new URL(meta.token_endpoint as string).pathname,
  };
}

interface Flow {
  clientId: string;
  redirectUri: string;
  authorizeParams: Record<string, string>;
}

async function runFlow(flow: Flow, assertion?: Record<string, string>): Promise<{ tokens: Tokens; tokenPath: string; connectionId: string }> {
  const { connectionId, url } = await mintConnection();
  const { authorize, token } = await discover(connectionId, url);
  const { verifier, challenge } = await pkce();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: flow.clientId,
    redirect_uri: flow.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'state-1',
    resource: url,
    ...flow.authorizeParams,
  });
  const authRes = await app.request(`${authorize}?${params}`);
  expect(authRes.status).toBe(302);
  const location = new URL(authRes.headers.get('Location') ?? '');
  expect(location.pathname).toBe('/connect');
  const requestId = location.searchParams.get('request') ?? '';

  const view = (await (await app.request(`/oauth/requests/${requestId}`)).json()) as {
    clientName: string;
    unverified: boolean;
    scopes: string[];
    connection: { usable: boolean };
  };
  expect(view.unverified).toBe(false);
  expect(view.scopes).toEqual(['read', 'write']);
  expect(view.connection.usable).toBe(true);

  const decision = await app.request(`/oauth/requests/${requestId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' }),
  });
  expect(decision.status).toBe(200);
  const redirect = new URL(((await decision.json()) as { redirect: string }).redirect);
  expect(`${redirect.origin}${redirect.pathname}`).toBe(flow.redirectUri.split('?')[0]);
  expect(redirect.searchParams.get('state')).toBe('state-1');
  const code = redirect.searchParams.get('code') ?? '';
  expect(code).not.toBe('');

  const exchange = await tokenRequest(token, {
    grant_type: 'authorization_code',
    code,
    client_id: flow.clientId,
    redirect_uri: flow.redirectUri,
    code_verifier: verifier,
    resource: url,
    ...assertion,
  });
  expect(exchange.status).toBe(200);
  const tokens = (await exchange.json()) as Tokens;
  expect(tokens.token_type).toBe('Bearer');
  expect(tokens.scope).toBe('read write');
  return { tokens, tokenPath: token, connectionId };
}

async function expectRefreshAndTools(flow: Flow, tokens: Tokens, tokenPath: string, connectionId: string): Promise<void> {
  const refreshed = await tokenRequest(tokenPath, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: flow.clientId });
  expect(refreshed.status).toBe(200);
  const next = (await refreshed.json()) as Tokens;
  expect(next.access_token).not.toBe(tokens.access_token);
  expect(next.refresh_token).not.toBe(tokens.refresh_token);

  const list = await app.request(`/mcp/c/${connectionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${next.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  expect(list.status).toBe(200);
  const body = (await list.json()) as { result?: { tools?: unknown[] } };
  expect(Array.isArray(body.result?.tools)).toBe(true);
  expect(body.result?.tools?.length).toBeGreaterThan(0);
}

const codexFlow: Flow = {
  clientId: CODEX.client_id as string,
  redirectUri: 'http://127.0.0.1:53682/callback/wWcGULoNCUs0',
  authorizeParams: { scope: 'read write' },
};

const chatgptFlow: Flow = {
  clientId: CHATGPT.client_id as string,
  redirectUri: 'https://chatgpt.com/connector/oauth/2amD8qR6vy_j',
  authorizeParams: { scope: 'read write', ui_locales: 'en-US' },
};

describe('Codex client document', () => {
  it('completes discovery, consent, PKCE exchange, refresh and tools/list as a public client', async () => {
    const { tokens, tokenPath, connectionId } = await runFlow(codexFlow);
    expect(vi.mocked(fetchUpstreamWithPolicy).mock.calls[0][0]).toBe(CODEX.client_id);
    await expectRefreshAndTools(codexFlow, tokens, tokenPath, connectionId);
  });

  it('shows the document name and website on the consent view', async () => {
    const { connectionId, url } = await mintConnection();
    const { challenge } = await pkce();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: codexFlow.clientId,
      redirect_uri: codexFlow.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 's',
      resource: url,
      scope: 'read write',
    });
    const res = await app.request(`/oauth/c/${connectionId}/authorize?${params}`);
    const requestId = new URL(res.headers.get('Location') ?? '').searchParams.get('request');
    const view = (await (await app.request(`/oauth/requests/${requestId}`)).json()) as { clientName: string; clientHost: string };
    expect(view).toMatchObject({ clientName: 'Codex', clientHost: 'chatgpt.com' });
  });

  it('accepts the localhost redirect from the document on any port', async () => {
    const { connectionId } = await mintConnection();
    const { challenge } = await pkce();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: codexFlow.clientId,
      redirect_uri: 'http://localhost:60001/callback/wWcGULoNCUs0',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 's',
      scope: 'read write',
    });
    expect((await app.request(`/oauth/c/${connectionId}/authorize?${params}`)).status).toBe(302);
    params.set('redirect_uri', 'http://127.0.0.1:60001/callback/other');
    expect((await app.request(`/oauth/c/${connectionId}/authorize?${params}`)).status).toBe(400);
  });
});

describe('ChatGPT client document', () => {
  it('completes discovery, consent, PKCE exchange, refresh and tools/list despite preferring private_key_jwt', async () => {
    expect(CHATGPT.token_endpoint_auth_method).toBe('private_key_jwt');
    const { tokens, tokenPath, connectionId } = await runFlow(chatgptFlow);
    await expectRefreshAndTools(chatgptFlow, tokens, tokenPath, connectionId);
  });

  it('ignores client_assertion parameters and treats the client as public', async () => {
    const { tokens, tokenPath, connectionId } = await runFlow(chatgptFlow, {
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: 'eyJhbGciOiJSUzI1NiJ9.e30.c2ln',
    });
    await expectRefreshAndTools(chatgptFlow, tokens, tokenPath, connectionId);
  });

  it('ignores client_assertion parameters on refresh', async () => {
    const { tokens, tokenPath } = await runFlow(chatgptFlow);
    const refreshed = await tokenRequest(tokenPath, {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: chatgptFlow.clientId,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: 'eyJhbGciOiJSUzI1NiJ9.e30.c2ln',
    });
    expect(refreshed.status).toBe(200);
  });

  it('rejects a redirect address outside the document', async () => {
    const { connectionId } = await mintConnection();
    const { challenge } = await pkce();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: chatgptFlow.clientId,
      redirect_uri: 'https://chatgpt.com/connector/oauth/other',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 's',
      scope: 'read write',
    });
    expect((await app.request(`/oauth/c/${connectionId}/authorize?${params}`)).status).toBe(400);
  });

  it('answers the OpenID configuration probe with a JSON 404', async () => {
    const res = await app.request('/.well-known/openid-configuration');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(await res.json()).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});

describe('client document authentication fields', () => {
  const CLIENT_URL = 'https://agent.example/oauth/client.json';
  const REDIRECT = 'https://agent.example/callback';

  const cases: Array<[string, Record<string, unknown>, boolean]> = [
    ['method absent', {}, true],
    ['none', { token_endpoint_auth_method: 'none' }, true],
    ['private_key_jwt only', { token_endpoint_auth_method: 'private_key_jwt', token_endpoint_auth_methods_supported: ['private_key_jwt'] }, false],
    ['private_key_jwt with none supported', { token_endpoint_auth_method: 'private_key_jwt', token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'] }, true],
    ['client_secret_basic with none supported', { token_endpoint_auth_method: 'client_secret_basic', token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'] }, true],
    ['client_secret_post only', { token_endpoint_auth_method: 'client_secret_post', token_endpoint_auth_methods_supported: ['client_secret_post'] }, false],
    ['client_secret_post with no supported list', { token_endpoint_auth_method: 'client_secret_post' }, false],
    ['malformed supported field', { token_endpoint_auth_method: 'private_key_jwt', token_endpoint_auth_methods_supported: 'none' }, false],
    ['malformed supported object', { token_endpoint_auth_method: 'private_key_jwt', token_endpoint_auth_methods_supported: { none: true } }, false],
  ];

  it.each(cases)('%s', async (_name, fields, accepted) => {
    serveDocuments({ [CLIENT_URL]: { client_id: CLIENT_URL, client_name: 'Synthetic', redirect_uris: [REDIRECT], ...fields } });
    const { connectionId } = await mintConnection();
    const { challenge } = await pkce();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_URL,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 's',
      scope: 'read',
    });
    const res = await app.request(`/oauth/c/${connectionId}/authorize?${params}`);
    expect(res.status).toBe(accepted ? 302 : 400);
    if (accepted) expect(new URL(res.headers.get('Location') ?? '').pathname).toBe('/connect');
  });
});
