import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Miniflare } from 'miniflare';

const POLL_MIGRATIONS = ['0001_feed_polling.sql', '0002_permanent_feed_redirects.sql', '0003_feed_body_hash.sql']
  .map((name) => readFileSync(path.resolve(__dirname, `../server/migrations-poll/${name}`), 'utf8'));

export async function applyPollMigration(mf: Miniflare, options: { maintainedAt?: number } = {}): Promise<void> {
  const db = await mf.getD1Database('POLL_DB');
  for (const migration of POLL_MIGRATIONS) {
    const statements = migration
      .replace(/--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  if (options.maintainedAt !== undefined) {
    await db.prepare("INSERT INTO poll_meta (key, value) VALUES ('maintained_at', ?)").bind(options.maintainedAt).run();
  }
}
