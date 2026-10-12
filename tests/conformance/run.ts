import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SERVER_PORT = 18787;
const PROXY_PORT = 18788;
const SYNC_KEY = 'c'.repeat(22);
const SECRET = 'conformance-only-secret-0123456789abcdef';
const REDIRECT = 'http://127.0.0.1:9876/callback';
const BASELINE = join(import.meta.dirname, 'expected-failures.yml');

async function expectStatus(response: Response, status: number, step: string): Promise<Response> {
  if (response.status !== status) throw new Error(`${step} returned ${response.status}: ${await response.text()}`);
  return response;
}

async function connect(): Promise<string> {
  const base = `http://localhost:${SERVER_PORT}`;
  const json = (body: unknown, key?: string): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'X-Sync-Key': key } : {}) },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  await expectStatus(await fetch(`${base}/sync/register`, json({}, SYNC_KEY)), 204, 'Account registration');
  const client = await (await expectStatus(await fetch(`${base}/oauth/oauth2/register`, json({
    client_name: 'Conformance', application_type: 'native', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: 'read write',
  })), 201, 'Client registration')).json() as { client_id: string };
  const verifier = 'v'.repeat(43);
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const query = new URLSearchParams({
    client_id: client.client_id, redirect_uri: REDIRECT, response_type: 'code', scope: 'read write', state: 'conformance',
    code_challenge: challenge, code_challenge_method: 'S256', resource: `${base}/mcp`,
  });
  const authorize = await fetch(`${base}/oauth/oauth2/authorize?${query}`, { headers: { accept: 'text/html' }, redirect: 'manual' });
  const signed = authorize.headers.get('location') ?? (await authorize.json() as { url: string }).url;
  const start = await expectStatus(await fetch(new URL(signed, base), { redirect: 'manual' }), 302, 'Approval start');
  const requestId = new URL(start.headers.get('location')!).searchParams.get('request');
  const decision = await (await expectStatus(await fetch(`${base}/oauth/requests/${requestId}/decision`, json({ decision: 'approve' }, SYNC_KEY)), 200, 'Approval')).json() as { redirect: string };
  const code = new URL(decision.redirect).searchParams.get('code')!;
  const token = await expectStatus(await fetch(`${base}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, code, redirect_uri: REDIRECT, code_verifier: verifier, resource: `${base}/mcp` }),
  }), 200, 'Token exchange');
  return (await token.json() as { access_token: string }).access_token;
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
      { host: 'localhost', port: SERVER_PORT, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${SERVER_PORT}`, authorization: `Bearer ${token}` } },
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
  server = run('npx', ['tsx', 'server/node.ts'], {
    PORT: String(SERVER_PORT),
    SIFT_DATA_DIR: directory,
    FEED_POLLING: 'true',
    BETTER_AUTH_SECRET: SECRET,
  });
  await waitForServer();
  proxy = await startProxy(await connect());
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
