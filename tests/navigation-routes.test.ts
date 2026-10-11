import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openNodeSqlite } from '../server/node-sqlite';
import { createSelfHostedDatabases } from '../server/sqlite-d1';
import { createApp } from '../server/handle';
import { APP_SHELL_ROUTES, FETCH_ONLY_ROUTES, SERVER_NAVIGATION_DENYLIST, WORKER_FIRST_ROUTES } from '../server/navigation-routes';

let directory: string;
let paths: string[];
let close: () => void;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'sift-routes-'));
  const databases = await createSelfHostedDatabases(directory, openNodeSqlite);
  close = () => {
    databases.sync.connection.close?.();
    databases.poll.connection.close?.();
  };
  const app = createApp({ db: databases.sync as unknown as D1Database, pollDb: databases.poll as unknown as D1Database });
  paths = [...new Set(app.routes.map((r) => r.path))].filter((p) => p !== '/*' && p !== '*');
});

afterAll(() => {
  close();
  rmSync(directory, { recursive: true, force: true });
});

function concrete(path: string): string {
  return path.replace(/:[^/]+/g, 'x').replace(/\/\*$/, '/x');
}

const denied = (path: string) => SERVER_NAVIGATION_DENYLIST.some((re) => re.test(path));

describe('service worker navigation fallback', () => {
  it('leaves every server route to the server unless it is fetch-only or served by the app', () => {
    expect(paths.length).toBeGreaterThan(10);
    const unclassified = paths.filter((path) => {
      const sample = concrete(path);
      if (FETCH_ONLY_ROUTES.includes(path) || APP_SHELL_ROUTES.includes(path)) return false;
      return !denied(sample);
    });
    expect(unclassified).toEqual([]);
  });

  it('serves the app shell for its own pages', () => {
    for (const path of APP_SHELL_ROUTES) expect(denied(path)).toBe(false);
  });

  it('covers the OAuth and MCP navigations agents open in a browser', () => {
    for (const path of ['/oauth/authorize', '/oauth/c/abc/authorize', '/.well-known/oauth-authorization-server', '/mcp', '/mcp/c/abc']) {
      expect(denied(path)).toBe(true);
    }
  });
});

function globMatches(pattern: string, path: string): boolean {
  return pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

describe('Cloudflare asset routing', () => {
  it('runs the Worker before the single-page fallback for every server route a browser can navigate to', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    const match = /^run_worker_first = (\[.*\])$/m.exec(toml);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]) as string[]).toEqual(WORKER_FIRST_ROUTES);

    const navigable = paths.filter((path) => !FETCH_ONLY_ROUTES.includes(path) && !APP_SHELL_ROUTES.includes(path));
    const uncovered = navigable.filter((path) => !WORKER_FIRST_ROUTES.some((pattern) => globMatches(pattern, concrete(path))));
    expect(uncovered).toEqual([]);
  });
});
