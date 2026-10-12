import { mkdtempSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeJwt } from 'jose';
import { openNodeSqlite } from '../server/node-sqlite';
import { createSelfHostedDatabases } from '../server/sqlite-d1';
import { createApp } from '../server/handle';
import { runSyncCron } from '../server/sync/cron';
import { clearOriginGovernorForTests } from '../server/origin-governor';
import { KEY, OTHER_KEY, ORIGIN, REDIRECT, SECRET, approve, connected, exchange, form, initialize, json, pending, read, type Fetcher } from './oauth-harness';

let fetcher: Fetcher;
let db: D1Database;
let close: () => void;
let directory: string;
beforeEach(async () => {
  clearOriginGovernorForTests();
  directory = mkdtempSync('/tmp/sift-provider-test-');
  const databases = await createSelfHostedDatabases(directory, openNodeSqlite);
  db = databases.sync as unknown as D1Database;
  close = () => { databases.sync.connection.close?.(); databases.poll.connection.close?.(); };
  const app = createApp({ db, oauthSecret: SECRET });
  fetcher = async (path, init) => app.request(ORIGIN + path, init);
  await initialize(fetcher);
});
afterEach(() => { vi.useRealTimers(); close(); rmSync(directory, { recursive: true, force: true }); });

async function grants(key = KEY) {
  return (await (await fetcher('/sync/tokens', { headers: { 'X-Sync-Key': key } })).json() as { tokens: Array<{ token_id: string; label: string; origin: string; fingerprint: string }> }).tokens;
}
async function refresh(request: Awaited<ReturnType<typeof connected>>, token = request.tokens.refresh_token) {
  return fetcher(request.prefix + '/oauth2/token', form({ grant_type: 'refresh_token', refresh_token: token, client_id: request.client.client_id as string, resource: request.resource }));
}

describe('library-managed OAuth and Sift approvals', () => {
  it('connects across browsers without a Sift key and never exposes a provider session', async () => {
    const request = await connected(fetcher);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(200);
    const payload = decodeJwt(request.tokens.access_token);
    expect(payload.sub).not.toBe(KEY);
    expect(JSON.stringify(payload)).not.toContain(KEY);
    expect(payload.iss).toBe(ORIGIN + request.prefix);
    expect(payload.aud).toBe(request.resource);
    const rows = await grants();
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('oauth');
    expect((await grants(OTHER_KEY))).toHaveLength(0);
    expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }))).status).toBe(409);
  });

  it('connects when a client relies on the issuer to identify its resource', async () => {
    const request = await connected(fetcher, { omitResource: true });
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(200);
  });

  it('keeps canonical URL approval and code fallback available', async () => {
    const request = await pending(fetcher, { canonical: true });
    expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }))).status).toBe(401);
    const view = await (await fetcher(`/oauth/requests/${request.requestId}`)).json() as { approvalCode: string };
    expect((await fetcher(`/oauth/approvals/${view.approvalCode}/decision`, json({ decision: 'approve' }, KEY))).status).toBe(200);
    const decided = await (await fetcher(`/oauth/requests/${request.requestId}`)).json() as { redirect: string };
    const code = new URL(decided.redirect).searchParams.get('code')!;
    expect((await exchange(fetcher, request, code)).status).toBe(200);
    expect((await (await fetcher(`/oauth/requests/${request.requestId}`)).json() as { redirect?: string }).redirect).toBeUndefined();
  });

  it('does not let another signed-in account take over a connection', async () => {
    const request = await pending(fetcher);
    expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }, OTHER_KEY))).status).toBe(409);
    const view = await (await fetcher(`/oauth/requests/${request.requestId}`)).json() as { approvalCode: string };
    expect((await fetcher(`/oauth/approvals/${view.approvalCode}/decision`, json({ decision: 'approve' }, OTHER_KEY))).status).toBe(401);
    expect(await grants(OTHER_KEY)).toHaveLength(0);
    expect(await approve(fetcher, request)).toBeTruthy();
  });

  it('consumes each link once even with concurrent authorization requests', async () => {
    const request = await pending(fetcher);
    const start = await fetcher(request.signedUrl.pathname + request.signedUrl.search);
    const otherId = new URL(start.headers.get('location')!).searchParams.get('request');
    const decisions = await Promise.all([
      fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' })),
      fetcher(`/oauth/requests/${otherId}/decision`, json({ decision: 'approve' })),
    ]);
    expect(decisions.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await grants()).toHaveLength(1);
  });

  it('rejects tampered approval queries and expired connection links', async () => {
    const request = await pending(fetcher);
    const tampered = new URL(request.signedUrl);
    tampered.searchParams.set('redirect_uri', 'https://attacker.example/callback');
    expect((await fetcher(tampered.pathname + tampered.search)).status).toBe(400);
    await db.prepare('UPDATE agent_connections SET expires_at = 0').run();
    expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }))).status).toBe(401);
  });

  it('allows explicit same-account approval after a link expires or is consumed', async () => {
    for (const expired of [true, false]) {
      const request = await pending(fetcher);
      await db.prepare(expired ? 'UPDATE agent_connections SET expires_at = 0' : 'UPDATE agent_connections SET used_at = 1').run();
      expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }))).status).toBe(401);
      expect((await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'approve' }, OTHER_KEY))).status).toBe(401);
      const code = await approve(fetcher, request, KEY);
      expect((await exchange(fetcher, request, code)).status).toBe(200);
    }
  });

  it('denies access without creating a grant', async () => {
    const request = await pending(fetcher);
    const response = await fetcher(`/oauth/requests/${request.requestId}/decision`, json({ decision: 'deny' }));
    expect(response.status).toBe(200);
    const callback = new URL((await response.json() as { redirect: string }).redirect);
    expect(callback.searchParams.get('error')).toBe('access_denied');
    expect(await grants()).toHaveLength(0);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM "user"').first<{ n: number }>())?.n).toBe(0);
  });

  it('rejects a missing or incorrect PKCE verifier and authorization-code replay', async () => {
    const request = await pending(fetcher);
    const code = await approve(fetcher, request);
    expect((await exchange(fetcher, request, code, { code_verifier: 'b'.repeat(43) })).status).toBe(401);
    expect((await exchange(fetcher, request, code)).status).toBe(400);
    const fresh = await connected(fetcher);
    expect((await exchange(fetcher, fresh, fresh.code)).status).toBe(400);
  });

  it('rotates refresh tokens and revokes the grant on reuse', async () => {
    const request = await connected(fetcher);
    const response = await refresh(request);
    expect(response.status).toBe(200);
    const tokens = await response.json() as { access_token: string; refresh_token: string };
    expect(tokens.refresh_token).not.toBe(request.tokens.refresh_token);
    expect((await read(fetcher, tokens.access_token)).status).toBe(200);
    expect((await refresh(request)).status).toBe(400);
    expect((await read(fetcher, tokens.access_token)).status).toBe(401);
    expect((await refresh(request, tokens.refresh_token)).status).toBe(400);
  });

  it('omits a grant from the listing and cleanup once refresh reuse ends it', async () => {
    const request = await connected(fetcher);
    const response = await refresh(request);
    expect(response.status).toBe(200);
    expect((await refresh(request)).status).toBe(400);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(await grants()).toHaveLength(0);
    await runSyncCron(db);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM agent_grants').first<number>('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM "user"').first<number>('n')).toBe(0);
  });

  it('keeps an approval awaiting code exchange for the code lifetime only', async () => {
    const request = await pending(fetcher);
    await approve(fetcher, request);
    await runSyncCron(db);
    expect(await grants()).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(await grants()).toHaveLength(0);
    await runSyncCron(db);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM agent_grants').first<number>('n')).toBe(0);
  });

  it('issues refresh tokens to clients that request only resource scopes, including registered scopes', async () => {
    const client = await (await fetcher('/oauth/oauth2/register', json({
      client_name: 'Scoped Agent', application_type: 'native', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: 'read write',
    }))).json() as Record<string, unknown>;
    expect(client.scope).toBe('read write offline_access');
    const request = await connected(fetcher, { client, scopes: 'read write', canonical: true });
    expect(request.tokens.scope).toBe('read write offline_access');
    expect((await refresh(request)).status).toBe(200);
    const readOnly = await connected(fetcher, { scopes: 'read' });
    expect(readOnly.tokens.scope).toBe('read offline_access');
    expect(readOnly.tokens.refresh_token).toBeTruthy();
  });

  it('keeps a regularly refreshed connection beyond a year and ends one unused for a year', async () => {
    const day = 86_400_000;
    let now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    const request = await connected(fetcher, { scopes: 'read write' });
    const idle = await connected(fetcher, { scopes: 'read write' });
    now += 2 * 60 * 60_000;
    vi.setSystemTime(now);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(401);
    let current = request.tokens.refresh_token;
    for (const step of [0, 364 * day, 364 * day]) {
      now += step;
      vi.setSystemTime(now);
      const response = await refresh(request, current);
      expect(response.status, await response.clone().text()).toBe(200);
      const tokens = await response.json() as { access_token: string; refresh_token: string };
      expect((await read(fetcher, tokens.access_token)).status).toBe(200);
      current = tokens.refresh_token;
    }
    expect((await refresh(idle)).status).toBe(400);
    await runSyncCron(db, now);
    expect(await grants()).toHaveLength(1);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM agent_grants').first<number>('n')).toBe(1);
  });

  it('renames and revokes only the selected agent, immediately for access and refresh', async () => {
    const first = await connected(fetcher);
    const second = await connected(fetcher);
    const [grant] = await grants();
    const rename = { ...json({ tokenId: grant.token_id, label: 'Work agent' }, KEY), method: 'PATCH' };
    expect((await fetcher('/sync/tokens', rename)).status).toBe(204);
    expect((await grants())[0].label).toBe('Work agent');
    expect((await fetcher('/sync/tokens', { ...json({ token_id: grant.token_id }, OTHER_KEY), method: 'DELETE' })).status).toBe(204);
    expect((await read(fetcher, first.tokens.access_token)).status).toBe(200);
    expect((await fetcher('/sync/tokens', { ...json({ token_id: grant.token_id }, KEY), method: 'DELETE' })).status).toBe(204);
    expect((await read(fetcher, first.tokens.access_token)).status).toBe(401);
    expect((await refresh(first)).status).toBe(400);
    expect((await read(fetcher, second.tokens.access_token)).status).toBe(200);
  });

  it('enforces read scopes, signature, audience, expiration and master-only boundaries', async () => {
    const request = await connected(fetcher, { scopes: 'read offline_access' });
    const token = request.tokens.access_token;
    expect((await read(fetcher, token)).status).toBe(200);
    expect((await fetcher('/sync/push', { ...json({ feeds: [] }), headers: { ...json({}).headers, authorization: `Bearer ${token}` } })).status).toBe(403);
    expect((await read(fetcher, token, '/sync/tokens')).status).toBe(401);
    const invalid = token.slice(0, -4) + 'xxxx';
    expect((await read(fetcher, invalid)).status).toBe(401);
    expect((await fetcher('/mcp', { ...json({}), headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
    await db.prepare('UPDATE session SET expiresAt = ?').bind(new Date(0).toISOString()).run();
    expect((await read(fetcher, token)).status).toBe(401);
  });

  it('deletes provider credentials when the real account rotation endpoint runs', async () => {
    const request = await connected(fetcher);
    expect((await fetcher('/sync/rotate', json({ sync_key: 'r'.repeat(22) }, KEY))).status).toBe(204);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(401);
    expect((await refresh(request)).status).toBe(400);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM agent_grants').first<number>('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM session').first<number>('n')).toBe(0);
  });

  it('invalidates grants after account rotation or deletion and removes provider credentials', async () => {
    const request = await connected(fetcher);
    await db.prepare('UPDATE users SET rotated_at = ? WHERE sync_key = ?').bind(Date.now(), KEY).run();
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(401);
    await db.prepare('UPDATE users SET rotated_at = NULL WHERE sync_key = ?').bind(KEY).run();
    expect((await fetcher('/sync/account', { method: 'DELETE', headers: { 'X-Sync-Key': KEY } })).status).toBe(204);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(401);
    expect((await refresh(request)).status).toBe(400);
    for (const table of ['agent_grants', 'user', 'session', 'oauthRefreshToken', 'oauthConsent']) {
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).first<number>('n')).toBe(0);
    }
  });

  it('cleans expired approval state and expired identities without deleting live agents', async () => {
    const request = await connected(fetcher);
    await pending(fetcher);
    await db.prepare('UPDATE agent_approvals SET expires_at = 0').run();
    await db.prepare('UPDATE agent_connections SET expires_at = 0').run();
    await runSyncCron(db);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM agent_approvals').first<number>('n')).toBe(0);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(200);
    await db.prepare('UPDATE session SET expiresAt = ?').bind(new Date(0).toISOString()).run();
    await runSyncCron(db);
    expect(await grants()).toHaveLength(0);
  });

  it('fails closed without a secret and exposes only intended protocol endpoints', async () => {
    const app = createApp({ db });
    expect((await app.request('/.well-known/oauth-protected-resource')).status).toBe(503);
    expect((await app.request('/sync/pull', { headers: { 'X-Sync-Key': KEY } })).status).toBe(200);
    for (const path of ['/oauth/sign-in/anonymous', '/oauth/sign-up/email', '/oauth/get-session', '/oauth/token', '/oauth/register']) {
      expect((await fetcher(path, json({}))).status, path).toBe(404);
    }
    expect((await fetcher('/oauth/requests/missing/decision', { ...json({ decision: 'approve' }), headers: { origin: 'https://attacker.example' } })).status).toBe(403);
  });
});
