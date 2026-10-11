import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { afterEach, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { openNodeSqlite } from '../server/node-sqlite';
import { createSelfHostedDatabases } from '../server/sqlite-d1';
import { createApp } from '../server/handle';
import { clearOriginGovernorForTests } from '../server/origin-governor';
import { KEY, ORIGIN, SECRET, approve, connected, exchange, form, initialize, json, pending, read, type Fetcher, type Tokens } from './oauth-harness';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/oauth-clients/${name}.json`, import.meta.url), 'utf8')) as Record<string, unknown>;
const codex = fixture('codex');
const chatgpt = fixture('chatgpt');
const dispose: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const close of dispose.splice(0)) await close(); });

async function setup(runtime: 'Node' | 'Workers' | 'Bun', documents: Record<string, unknown>): Promise<Fetcher> {
  clearOriginGovernorForTests();
  if (runtime === 'Node') {
    const directory = mkdtempSync('/tmp/sift-cimd-');
    const databases = await createSelfHostedDatabases(directory, openNodeSqlite);
    dispose.push(() => { databases.sync.connection.close?.(); databases.poll.connection.close?.(); rmSync(directory, { recursive: true, force: true }); });
    const app = createApp({ db: databases.sync as unknown as D1Database, oauthSecret: SECRET, oauthMetadataFetch: async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return documents[url] ? Response.json(documents[url]) : new Response(null, { status: 404 });
    } });
    const fetcher: Fetcher = async (path, init) => app.request(ORIGIN + path, init);
    await initialize(fetcher);
    return fetcher;
  }
  if (runtime === 'Bun') {
    const directory = mkdtempSync('/tmp/sift-bun-auth-');
    const listener = createServer();
    listener.listen(0, '127.0.0.1');
    await once(listener, 'listening');
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('Could not allocate a test port');
    const port = address.port;
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    const child = spawn(bun, ['tests/oauth-bun-server.ts'], {
      env: { ...process.env, PORT: String(port), SIFT_DATA_DIR: directory, DOCUMENTS: JSON.stringify(documents) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stderr.on('data', (data) => { output += String(data).slice(0, 2000); });
    dispose.push(async () => {
      if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
      rmSync(directory, { recursive: true, force: true });
    });
    const fetcher: Fetcher = (path, init) => fetch(`http://127.0.0.1:${port}${path}`, { ...init, redirect: 'manual' });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Bun server exited: ${output}`);
      try { ready = (await fetcher('/sync/capabilities')).status === 200; } catch { }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!ready) throw new Error(`Bun server did not start: ${output}`);
    await initialize(fetcher);
    return fetcher;
  }
  const result = await build({ entryPoints: [new URL('./oauth-worker.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], conditions: ['workerd', 'worker', 'browser'], external: ['node:*'] });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: result.outputFiles[0].text, compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], d1Databases: ['DB'], bindings: { BETTER_AUTH_SECRET: SECRET, DOCUMENTS: JSON.stringify(documents) } }));
  dispose.push(() => mf.dispose());
  const fetcher: Fetcher = async (path, init) => {
    const response = await mf.dispatchFetch(ORIGIN + path, { ...init, headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body as string | URLSearchParams | undefined, redirect: 'manual' });
    return new Response(response.status === 204 ? null : await response.arrayBuffer(), { status: response.status, headers: Object.fromEntries(response.headers) });
  };
  await initialize(fetcher);
  return fetcher;
}

const bun = process.env.SIFT_TEST_BUN ?? 'bun';
const hasBun = spawnSync(bun, ['--version']).status === 0;
const runtimes: Array<'Node' | 'Workers' | 'Bun'> = hasBun ? ['Node', 'Workers', 'Bun'] : ['Node', 'Workers'];

describe.each(runtimes)('%s client metadata and OAuth integration', (runtime) => {
  it('runs the convenient connection flow with the captured Codex metadata', async () => {
    const fetcher = await setup(runtime, { [codex.client_id as string]: codex });
    const request = await connected(fetcher, { client: codex });
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(200);
    const response = await fetcher(request.prefix + '/oauth2/token', form({ grant_type: 'refresh_token', refresh_token: request.tokens.refresh_token, client_id: codex.client_id as string, resource: request.resource }));
    expect(response.status, await response.clone().text()).toBe(200);
    const tokens = await response.json() as Tokens;
    expect(tokens.refresh_token).not.toBe(request.tokens.refresh_token);
    const list = await (await fetcher('/sync/tokens', { headers: { 'X-Sync-Key': KEY } })).json() as { tokens: Array<{ token_id: string; unverified: boolean }> };
    expect(list.tokens[0].unverified).toBe(false);
    expect((await fetcher('/sync/tokens', { ...json({ token_id: list.tokens[0].token_id }, KEY), method: 'DELETE' })).status).toBe(204);
    expect((await read(fetcher, tokens.access_token)).status).toBe(401);
    expect((await fetcher(request.prefix + '/oauth2/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: codex.client_id as string, resource: request.resource }))).status).toBe(400);
  }, 30_000);

  it('requires and verifies ChatGPT signed client authentication', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const key = { ...await exportJWK(publicKey), alg: 'RS256', kid: 'test-key', use: 'sig' };
    const fetcher = await setup(runtime, { [chatgpt.client_id as string]: chatgpt, [chatgpt.jwks_uri as string]: { keys: [key] } });
    const rejected = await pending(fetcher, { client: chatgpt });
    const rejectedCode = await approve(fetcher, rejected);
    expect((await exchange(fetcher, rejected, rejectedCode)).status).toBe(400);
    const request = await pending(fetcher, { client: chatgpt });
    const code = await approve(fetcher, request);
    const assertion = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(chatgpt.client_id as string).setSubject(chatgpt.client_id as string).setAudience(request.metadata.token_endpoint).setIssuedAt().setExpirationTime('1m').setJti(crypto.randomUUID()).sign(privateKey);
    const response = await exchange(fetcher, request, code, { client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assertion });
    expect(response.status, await response.clone().text()).toBe(200);
    const tokens = await response.json() as Tokens;
    expect((await read(fetcher, tokens.access_token)).status).toBe(200);
    expect((await exchange(fetcher, request, code, { client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assertion })).status).toBe(400);
  }, 30_000);

  it('runs DCR, consent, PKCE, refresh and revocation through the same provider', async () => {
    const fetcher = await setup(runtime, {});
    const request = await connected(fetcher);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(200);
    expect((await fetcher(request.prefix + '/oauth2/revoke', form({ client_id: request.client.client_id as string, token: request.tokens.refresh_token, token_type_hint: 'refresh_token' }))).status).toBe(200);
    expect((await read(fetcher, request.tokens.access_token)).status).toBe(401);
  }, 30_000);
});
