import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openNodeSqlite } from '../../server/node-sqlite';
import { createSelfHostedDatabases } from '../../server/sqlite-d1';
import { generateToken, generateTokenId, sha256Hex, tokenFingerprint } from '../../server/sync/tokens';

const SERVER_PORT = 18787;
const PROXY_PORT = 18788;
const SYNC_KEY = 'c'.repeat(22);
const BASELINE = join(import.meta.dirname, 'expected-failures.yml');

async function seed(directory: string): Promise<string> {
  const databases = await createSelfHostedDatabases(directory, openNodeSqlite);
  const sync = databases.sync as unknown as D1Database;
  const now = Math.floor(Date.now() / 1000);
  await sync.prepare('INSERT INTO users (sync_key, created_at) VALUES (?, ?)').bind(SYNC_KEY, now).run();
  const token = generateToken();
  const tokenId = generateTokenId();
  await sync
    .prepare(
      `INSERT INTO tokens
         (token_id, token_hash, sync_key, scope, fingerprint, created_at, origin, client_id, client_name, scopes, expires_at, refresh_hash, refresh_expires_at, family_id)
       VALUES (?, ?, ?, 'rw', ?, ?, 'oauth', 'conformance', 'Conformance', 'read write', ?, ?, ?, ?)`,
    )
    .bind(
      tokenId,
      await sha256Hex(token),
      SYNC_KEY,
      await tokenFingerprint(token),
      now,
      now + 3600,
      await sha256Hex(`refresh-${tokenId}`),
      now + 86_400,
      `family-${tokenId}`,
    )
    .run();
  return token;
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`http://localhost:${SERVER_PORT}/mcp`, { method: 'POST' });
      if (res.status === 401) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The Sift server did not start.');
}

function startProxy(token: string) {
  const proxy = createServer((req, res) => {
    const upstream = httpRequest(
      { host: 'localhost', port: SERVER_PORT, method: req.method, path: req.url, headers: { ...req.headers, authorization: `Bearer ${token}` } },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502).end();
    });
    req.pipe(upstream);
  });
  return new Promise<typeof proxy>((resolve) => proxy.listen(PROXY_PORT, '127.0.0.1', () => resolve(proxy)));
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): ChildProcess {
  return spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
}

const directory = mkdtempSync(join(tmpdir(), 'sift-conformance-'));
let server: ChildProcess | undefined;
let proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
let code = 1;
try {
  const token = await seed(directory);
  server = run('npx', ['tsx', 'server/node.ts'], {
    PORT: String(SERVER_PORT),
    SIFT_DATA_DIR: directory,
    FEED_POLLING: 'true',
  });
  await waitForServer();
  proxy = await startProxy(token);
  const runner = run('npx', [
    'conformance',
    'server',
    '--url',
    `http://localhost:${PROXY_PORT}/mcp`,
    '--suite',
    'all',
    '--expected-failures',
    BASELINE,
  ]);
  code = await new Promise<number>((resolve) => runner.on('exit', (status) => resolve(status ?? 1)));
} finally {
  proxy?.close();
  server?.kill();
  rmSync(directory, { recursive: true, force: true });
}
process.exit(code);
