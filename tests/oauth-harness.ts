import { expect } from 'vitest';

export const ORIGIN = 'http://localhost';
export const KEY = 'oauthtestkey0000000001';
export const OTHER_KEY = 'oauthtestkey0000000002';
export const SECRET = 'oauth-integration-test-secret-01234567890123456789';
export const REDIRECT = 'http://127.0.0.1:9876/callback';
export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
export interface Tokens { access_token: string; refresh_token: string; scope: string }

export function json(body: unknown, key?: string): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'X-Sync-Key': key } : {}) }, body: JSON.stringify(body) };
}
export function form(body: Record<string, string>): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) };
}
export async function initialize(fetcher: Fetcher) {
  for (const key of [KEY, OTHER_KEY]) expect((await fetcher('/sync/register', json({}, key))).status).toBe(204);
}
export async function pending(fetcher: Fetcher, options: { canonical?: boolean; client?: Record<string, unknown>; scopes?: string; omitResource?: boolean } = {}) {
  const connection = options.canonical ? null : await (await fetcher('/sync/connections', json({}, KEY))).json() as { connectionId: string; url: string };
  const prefix = connection ? `/oauth/c/${connection.connectionId}` : '/oauth';
  const resource = connection?.url ?? `${ORIGIN}/mcp`;
  const metadata = await (await fetcher(`/.well-known/oauth-authorization-server${prefix}`)).json() as { issuer: string; authorization_endpoint: string; token_endpoint: string; registration_endpoint: string };
  expect(metadata.issuer).toBe(ORIGIN + prefix);
  const client = options.client ?? await (await fetcher(new URL(metadata.registration_endpoint).pathname, json({
    client_name: 'Test Agent', application_type: 'native', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: 'read write offline_access',
  }))).json() as Record<string, unknown>;
  const verifier = 'a'.repeat(43);
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const redirect = (client.redirect_uris as string[])[0].replace('http://127.0.0.1/', 'http://127.0.0.1:9876/');
  const query = new URLSearchParams({ client_id: client.client_id as string, redirect_uri: redirect, response_type: 'code', scope: options.scopes ?? 'read write offline_access', state: 'test-state', code_challenge: challenge, code_challenge_method: 'S256', resource });
  if (options.omitResource) query.delete('resource');
  const authorization = await fetcher(new URL(metadata.authorization_endpoint).pathname + '?' + query, { headers: { accept: 'text/html', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } });
  expect([200, 302]).toContain(authorization.status);
  const authorizationBody = authorization.status === 200 ? await authorization.json() as { redirect: boolean; url: string } : null;
  if (authorizationBody) expect(authorizationBody.redirect).toBe(true);
  const signedUrl = new URL(authorization.headers.get('location') ?? authorizationBody!.url);
  const start = await fetcher(signedUrl.pathname + signedUrl.search);
  expect(start.status).toBe(302);
  const requestId = new URL(start.headers.get('location')!).searchParams.get('request')!;
  return { connection, prefix, resource, metadata, client, verifier, challenge, redirect, requestId, query, signedUrl };
}
export async function approve(fetcher: Fetcher, request: Awaited<ReturnType<typeof pending>>, key?: string) {
  const consent = await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }, key));
  expect(consent.status).toBe(200);
  expect(consent.headers.get('set-cookie')).toBeNull();
  const callback = new URL((await consent.json() as { redirect: string }).redirect);
  expect(callback.searchParams.get('state')).toBe('test-state');
  return callback.searchParams.get('code')!;
}
export async function exchange(fetcher: Fetcher, request: Awaited<ReturnType<typeof pending>>, code: string, extra: Record<string, string> = {}) {
  return fetcher(`${request.prefix}/oauth2/token`, form({ grant_type: 'authorization_code', client_id: request.client.client_id as string, code, redirect_uri: request.redirect, code_verifier: request.verifier, resource: request.resource, ...extra }));
}
export async function connected(fetcher: Fetcher, options: Parameters<typeof pending>[1] = {}) {
  const request = await pending(fetcher, options);
  const code = await approve(fetcher, request, options.canonical ? KEY : undefined);
  const response = await exchange(fetcher, request, code);
  expect(response.status).toBe(200);
  return { ...request, code, tokens: await response.json() as Tokens };
}
export async function read(fetcher: Fetcher, token: string, path = '/sync/pull?since=0') {
  return fetcher(path, { headers: { authorization: `Bearer ${token}` } });
}
