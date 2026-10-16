/**
 * Sync-key rotation (/sync/rotate), which permanently retires the old key.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import * as esbuild from 'esbuild';
import path from 'path';

let workerCode: string;

beforeAll(async () => {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../server/sync/test-worker.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
  });
  workerCode = result.outputFiles[0].text;
}, 15_000);

function makeSyncKey(label: string): string {
  const raw = label + 'xxxxxxxxxxxxxxxxxxxx';
  return raw.slice(0, 22).replace(/[^A-Za-z0-9_-]/g, 'x');
}

async function createMf(): Promise<Miniflare> {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: workerCode,
    d1Databases: ['DB'],
  }));
  await mf.ready;
  return mf;
}

async function register(mf: Miniflare, key: string): Promise<number> {
  const res = await mf.dispatchFetch('http://localhost/sync/register', {
    method: 'POST',
    headers: { 'X-Sync-Key': key },
  });
  return res.status;
}

async function pushFeed(mf: Miniflare, key: string, feedUrl: string): Promise<number> {
  const res = await mf.dispatchFetch('http://localhost/sync/push', {
    method: 'POST',
    headers: { 'X-Sync-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeds: [{ feedId: feedUrl, feedUrl, title: 'Feed', deleted: 0 }],
    }),
  });
  return res.status;
}

function pull(
  mf: Miniflare,
  query: string,
  opts: { key?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.key) headers['X-Sync-Key'] = opts.key;
  if (opts.ip) headers['cf-connecting-ip'] = opts.ip;
  return mf.dispatchFetch(`http://localhost/sync/pull?${query}`, { headers });
}

describe('sync-key rotation orphans everything under the old key', () => {
  it('rotate deads the old key and register refuses to resurrect it', async () => {
    const mf = await createMf();
    try {
      const oldKey = makeSyncKey('rot-old---');
      const newKey = makeSyncKey('rot-new---');
      await register(mf, oldKey);
      expect(await pushFeed(mf, oldKey, 'https://ex.com/rot')).toBe(204);

      // Rotate.
      const rotate = await mf.dispatchFetch('http://localhost/sync/rotate', {
        method: 'POST',
        headers: { 'X-Sync-Key': oldKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_key: newKey }),
      });
      expect(rotate.status).toBe(204);

      // Old key is dead for pull and push.
      expect((await pull(mf, 'since=0', { key: oldKey })).status).toBe(401);
      expect(await pushFeed(mf, oldKey, 'https://ex.com/rot2')).toBe(401);

      // Register refuses to resurrect the old key.
      expect(await register(mf, oldKey)).toBe(403);

      // The new key is a live, empty group.
      expect((await pull(mf, 'since=0', { key: newKey })).status).toBe(200);
      const body = (await (await pull(mf, 'since=0', { key: newKey })).json()) as {
        feeds: unknown[];
      };
      expect(body.feeds).toEqual([]);
    } finally {
      await mf.dispose();
    }
  });

  it('rotate rejects malformed and identical keys', async () => {
    const mf = await createMf();
    try {
      const key = makeSyncKey('rot-invald');
      await register(mf, key);
      const bad = await mf.dispatchFetch('http://localhost/sync/rotate', {
        method: 'POST',
        headers: { 'X-Sync-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_key: 'not-a-key' }),
      });
      expect(bad.status).toBe(400);
      const same = await mf.dispatchFetch('http://localhost/sync/rotate', {
        method: 'POST',
        headers: { 'X-Sync-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_key: key }),
      });
      expect(same.status).toBe(400);
    } finally {
      await mf.dispose();
    }
  });

  it('rotate rejects a new key that already has an account and changes neither', async () => {
    const mf = await createMf();
    try {
      const key = makeSyncKey('rot-taken-');
      const other = makeSyncKey('rot-other-');
      const retired = makeSyncKey('rot-retire');
      const successor = makeSyncKey('rot-succes');
      await register(mf, key);
      await register(mf, other);
      await register(mf, retired);
      const rotate = (from: string, to: string) =>
        mf.dispatchFetch('http://localhost/sync/rotate', {
          method: 'POST',
          headers: { 'X-Sync-Key': from, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sync_key: to }),
        });
      expect((await rotate(retired, successor)).status).toBe(204);

      const live = await rotate(key, other);
      expect(live.status).toBe(409);
      expect(await live.json()).toEqual({ error: 'sync_key is already in use', field: 'sync_key' });
      expect((await rotate(key, retired)).status).toBe(409);

      expect((await pull(mf, 'since=0', { key })).status).toBe(200);
      expect((await pull(mf, 'since=0', { key: other })).status).toBe(200);
      expect((await pull(mf, 'since=0', { key: retired })).status).toBe(401);
    } finally {
      await mf.dispose();
    }
  });
});
