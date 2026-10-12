import { describe, it, expect, beforeAll } from 'vitest';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import * as esbuild from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'path';
import { parseScopes, rateLimitKey, type SyncKeyContext } from '../server/sync/auth';
import { RATE_LIMITS } from '../server/sync/ratelimit';

let workerCode: string;

beforeAll(async () => {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../server/sync/test-poll-worker.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    write: false,
  });
  workerCode = result.outputFiles[0].text;
}, 15_000);

type D1 = Awaited<ReturnType<Miniflare['getD1Database']>>;

function makeSyncKey(label: string): string {
  return (label + 'xxxxxxxxxxxxxxxxxxxxxx').slice(0, 22).replace(/[^A-Za-z0-9_-]/g, 'x');
}

async function createMf(): Promise<Miniflare> {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: workerCode,
    d1Databases: ['DB', 'POLL_DB'],
  }));
  await mf.ready;
  return mf;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function register(mf: Miniflare, key: string): Promise<void> {
  const res = await mf.dispatchFetch('http://localhost/sync/register', {
    method: 'POST',
    headers: { 'X-Sync-Key': key },
  });
  expect(res.status).toBe(204);
}

async function seedGrant(db: D1, key: string, tokenId: string): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO oauthClient (id, clientId, redirectUris, name, createdAt) VALUES ('c1', 'client-1', '[]', 'Test Agent', ?)").bind(new Date().toISOString()).run();
  await db
    .prepare("INSERT INTO agent_grants (token_id, user_id, sync_key, issuer, resource, client_id, fingerprint, scopes, created_at) VALUES (?, ?, ?, 'http://localhost/oauth', 'http://localhost/mcp', 'client-1', 'ABCD', 'read write offline_access', ?)")
    .bind(tokenId, `user-${tokenId}`, key, nowSeconds())
    .run();
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function pull(mf: Miniflare, headers: Record<string, string>, query = 'since=0'): Promise<Awaited<ReturnType<Miniflare['dispatchFetch']>>> {
  return mf.dispatchFetch(`http://localhost/sync/pull?${query}`, { headers });
}

function push(mf: Miniflare, headers: Record<string, string>, body: unknown): Promise<Awaited<ReturnType<Miniflare['dispatchFetch']>>> {
  return mf.dispatchFetch('http://localhost/sync/push', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function count(db: D1, sql: string, ...binds: unknown[]): Promise<number> {
  return (await db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
}

async function setup(label: string): Promise<{ mf: Miniflare; key: string; db: D1 }> {
  const mf = await createMf();
  const key = makeSyncKey(label);
  await register(mf, key);
  const db = await mf.getD1Database('DB');
  await db
    .prepare('CREATE TABLE IF NOT EXISTS feed_fetch_failures (feed_key TEXT PRIMARY KEY, status INTEGER NOT NULL, retry_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)')
    .run();
  return { mf, key, db };
}

describe('bearer authentication', () => {
  it('rejects unknown bearers, master keys and malformed values', async () => {
    const { mf, key } = await setup('bearer-bad');
    try {
      expect((await pull(mf, bearer('t' + 'a'.repeat(22)))).status).toBe(401);
      expect((await pull(mf, bearer(key))).status).toBe(401);
      expect((await pull(mf, bearer('nonsense'))).status).toBe(401);
    } finally {
      await mf.dispose();
    }
  });

  it('no longer offers CLI agent tokens or the CLI status route', async () => {
    const { mf, key } = await setup('cli-retired');
    try {
      expect((await pull(mf, { 'X-Sync-Key': 't' + 'a'.repeat(22) })).status).toBe(401);
      expect((await mf.dispatchFetch('http://localhost/sync/tokens', { method: 'POST', headers: { 'X-Sync-Key': key } })).status).toBe(404);
      expect((await mf.dispatchFetch('http://localhost/sync/tokens/redeem', { method: 'POST', body: JSON.stringify({ code: 'abcdefgh' }) })).status).toBe(404);
      expect((await mf.dispatchFetch('http://localhost/sync/status', { headers: { 'X-Sync-Key': key } })).status).toBe(404);
    } finally {
      await mf.dispose();
    }
  });

  it('does not authenticate a pull with a pairing code', async () => {
    const { mf, key } = await setup('code-gone--');
    try {
      const minted = await mf.dispatchFetch('http://localhost/sync/otp', { method: 'POST', headers: { 'X-Sync-Key': key } });
      const { code } = (await minted.json()) as { code: string };
      expect((await pull(mf, {}, `since=0&code=${code}`)).status).toBe(401);
    } finally {
      await mf.dispose();
    }
  });
});

interface TokenRow {
  token_id: string;
  label: string | null;
  client_name: string | null;
  scopes: string;
  created_at: number;
  last_seen_at: number | null;
}

async function listTokens(mf: Miniflare, key: string): Promise<TokenRow[]> {
  const res = await mf.dispatchFetch('http://localhost/sync/tokens', { headers: { 'X-Sync-Key': key } });
  expect(res.status).toBe(200);
  return ((await res.json()) as { tokens: TokenRow[] }).tokens;
}

function rename(mf: Miniflare, headers: Record<string, string>, body: unknown): Promise<Awaited<ReturnType<Miniflare['dispatchFetch']>>> {
  return mf.dispatchFetch('http://localhost/sync/tokens', {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('agent labels', () => {
  it('renames and clears a label with PATCH, master key only', async () => {
    const { mf, key, db } = await setup('label-patch-');
    try {
      await seedGrant(db, key, 'grant-1');
      const other = makeSyncKey('label-other-');
      await register(mf, other);
      const [row] = await listTokens(mf, key);
      expect(row).toMatchObject({ token_id: 'grant-1', label: null, client_name: 'Test Agent' });

      expect((await rename(mf, { 'X-Sync-Key': key }, { tokenId: row.token_id, label: '  Renamed ' })).status).toBe(204);
      expect((await listTokens(mf, key))[0].label).toBe('Renamed');
      expect((await rename(mf, { 'X-Sync-Key': key }, { tokenId: row.token_id, label: '' })).status).toBe(204);
      expect((await listTokens(mf, key))[0].label).toBeNull();

      expect((await rename(mf, { 'X-Sync-Key': key }, { tokenId: row.token_id, label: 'x'.repeat(65) })).status).toBe(400);
      expect((await rename(mf, { 'X-Sync-Key': key }, { tokenId: row.token_id })).status).toBe(400);
      expect((await rename(mf, { 'X-Sync-Key': key }, { label: 'a' })).status).toBe(400);
      expect((await rename(mf, { 'X-Sync-Key': key }, { tokenId: 'missing', label: 'a' })).status).toBe(404);
      expect((await rename(mf, { 'X-Sync-Key': other }, { tokenId: row.token_id, label: 'stolen' })).status).toBe(404);
      expect((await rename(mf, bearer('nonsense'), { tokenId: row.token_id, label: 'a' })).status).toBe(401);
      expect((await listTokens(mf, key))[0].label).toBeNull();
    } finally {
      await mf.dispose();
    }
  });
});

describe('scope enforcement', () => {

  it('parses scope strings defensively', () => {
    expect(parseScopes('read write')).toEqual(['read', 'write']);
    expect(parseScopes('write  read read admin')).toEqual(['write', 'read']);
    expect(parseScopes(null)).toEqual([]);
  });
});

describe('rate-limit buckets', () => {
  it('names per-agent buckets for OAuth principals and per-key buckets for master keys', () => {
    const master: SyncKeyContext = { syncKey: 'K', principal: { kind: 'master', syncKey: 'K', knownUser: true }, knownUser: true };
    const oauth: SyncKeyContext = { syncKey: 'K', principal: { kind: 'token', syncKey: 'K', tokenId: 'T2', scopes: ['read'] }, knownUser: true };
    expect(rateLimitKey(master, 'pull')).toBe('pull:K');
    expect(rateLimitKey(oauth, 'pull')).toBe('pull:tok:T2');
    expect(RATE_LIMITS.discover.limit).toBeGreaterThan(0);
  });
});

describe('push behaviour after the shared merge refactor', () => {
  it('still validates payloads, stamps writes and revives tombstones', async () => {
    const { mf, key } = await setup('push-same--');
    try {
      const auth = { 'X-Sync-Key': key };
      const bad = await push(mf, auth, { feeds: [{ feedId: '', feedUrl: 'https://ex.com/f' }] });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ field: 'feedId' });
      expect((await push(mf, auth, {})).status).toBe(204);

      const itemId = `${encodeURIComponent('feed-a')}::g1`;
      expect((await push(mf, auth, {
        feeds: [{ feedId: 'feed-a', feedUrl: 'https://ex.com/a', title: 'A', tags: ['x'], deleted: 0 }],
        flags: [{ itemId, feedId: 'feed-a', read: 1, starred: 1 }],
      })).status).toBe(204);
      expect((await push(mf, auth, { feeds: [{ feedId: 'feed-a', deleted: 1 }] })).status).toBe(204);
      expect((await push(mf, auth, { feeds: [{ feedId: 'feed-b', feedUrl: 'https://ex.com/a', deleted: 0 }] })).status).toBe(204);

      const body = (await (await pull(mf, auth)).json()) as {
        feeds: Array<{ feed_id: string; deleted: number; title: string }>;
        flags: Array<{ item_id: string; read: number; starred: number }>;
      };
      expect(body.feeds).toHaveLength(1);
      expect(body.feeds[0]).toMatchObject({ feed_id: 'feed-a', deleted: 0, title: 'A' });
      expect(body.flags).toMatchObject([{ item_id: itemId, read: 1, starred: 1 }]);
    } finally {
      await mf.dispose();
    }
  });
});

const migrationsDir = path.resolve(__dirname, '../server/migrations');
const migrationFiles = readdirSync(migrationsDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();

async function applyMigrations(db: D1, files: string[]): Promise<void> {
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    await db.batch(statements.map((s) => db.prepare(s)));
  }
}

describe('agent credential migrations', () => {
  it('cuts over old OAuth storage while preserving account data', async () => {
    const mf = await createMf();
    try {
      const db = await mf.getD1Database('DB');
      await applyMigrations(db, migrationFiles.filter((file) => file < '0013'));
      await db.prepare("INSERT INTO users (sync_key, created_at) VALUES ('account', 1)").run();
      await db.prepare("INSERT INTO tokens (token_id, token_hash, sync_key, scope, fingerprint, created_at, origin) VALUES ('paired', 'pairedhash', 'account', 'rw', 'ABCD', 1, 'paired'), ('oldoauth', 'oauthhash', 'account', 'rw', 'EFGH', 1, 'oauth')").run();
      await applyMigrations(db, migrationFiles.filter((file) => file.startsWith('0013')));
      expect(await db.prepare('SELECT token_id FROM tokens').all()).toMatchObject({ results: [{ token_id: 'paired' }] });
      expect(await count(db, 'SELECT COUNT(*) AS n FROM users')).toBe(1);
      expect((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('oauth_clients', 'oauth_connections', 'oauth_requests', 'oauth_codes')").all()).results).toEqual([]);
    } finally {
      await mf.dispose();
    }
  });

  it('removes CLI tokens and agent pairing codes but keeps device codes and accounts', async () => {
    const mf = await createMf();
    try {
      const db = await mf.getD1Database('DB');
      await applyMigrations(db, migrationFiles.filter((file) => file < '0014'));
      await db.prepare("INSERT INTO users (sync_key, created_at) VALUES ('account', 1)").run();
      await db.prepare("INSERT INTO tokens (token_id, token_hash, sync_key, scope, fingerprint, created_at) VALUES ('paired', 'pairedhash', 'account', 'rw', 'ABCD', 1)").run();
      await db.prepare("INSERT INTO pairing_codes (code, sync_key, expires_at, kind) VALUES ('device01', 'account', 9999999999, 'device'), ('agent001', 'account', 9999999999, 'agent')").run();
      await applyMigrations(db, migrationFiles.filter((file) => file >= '0014'));
      expect((await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('tokens', 'idx_tokens_sync_key')").all()).results).toEqual([]);
      expect((await db.prepare('SELECT code FROM pairing_codes').all()).results).toEqual([{ code: 'device01' }]);
      expect(await count(db, 'SELECT COUNT(*) AS n FROM users')).toBe(1);
    } finally {
      await mf.dispose();
    }
  });

  it('produces the same agent tables as the runtime schema, without CLI tokens', async () => {
    const fromMigrations = await createMf();
    const fromRuntime = await createMf();
    try {
      const migrated = await fromMigrations.getD1Database('DB');
      await applyMigrations(migrated, migrationFiles);
      await register(fromRuntime, makeSyncKey('schema-same'));
      const runtime = await fromRuntime.getD1Database('DB');
      const columns = async (db: D1, table: string) =>
        (await db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all<{ name: string }>()).results.map((r) => r.name).sort();
      for (const table of ['agent_connections', 'agent_approvals', 'agent_grants', 'user', 'session', 'oauthClient', 'oauthRefreshToken', 'pairing_codes']) {
        expect(await columns(migrated, table), table).toEqual(await columns(runtime, table));
      }
      expect(await columns(migrated, 'tokens')).toEqual([]);
      expect(await columns(runtime, 'tokens')).toEqual([]);
    } finally {
      await fromMigrations.dispose();
      await fromRuntime.dispose();
    }
  });
});
