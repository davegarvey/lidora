import { deleteAccount } from './account';
import { ENDED_GRANT_SQL, endedGrantBindings } from '../agent/oauth/lifetime';
import { currentMonotonicTime } from './monotonic';
import { STATE_RETENTION_MS } from '../origin-governor';

const TOMBSTONE_RETENTION_DAYS = 30;
const PAIRING_GRACE_DAYS = 1;
const RATE_LIMIT_MAX_WINDOW_SECONDS = 24 * 60 * 60; // the daily register:global window
export const ROTATED_ACCOUNT_RETENTION_DAYS = 30;
export const INACTIVE_ACCOUNT_RETENTION_DAYS = 365;
export const RETENTION_MAX_ACCOUNTS_PER_RUN = 50;

async function expiredAccountKeys(db: D1Database, nowSeconds: number): Promise<string[]> {
  const day = 24 * 60 * 60;
  const rotatedCutoff = nowSeconds - ROTATED_ACCOUNT_RETENTION_DAYS * day;
  const inactiveCutoff = nowSeconds - INACTIVE_ACCOUNT_RETENTION_DAYS * day;
  const keys: string[] = [];
  const queries: Array<[string, number]> = [
    ['SELECT sync_key FROM users WHERE rotated_at < ? LIMIT ?', rotatedCutoff],
    ['SELECT sync_key FROM users WHERE rotated_at IS NULL AND last_active_at < ? LIMIT ?', inactiveCutoff],
    ['SELECT sync_key FROM users WHERE rotated_at IS NULL AND last_active_at IS NULL AND created_at < ? LIMIT ?', inactiveCutoff],
  ];
  for (const [sql, cutoff] of queries) {
    const remaining = RETENTION_MAX_ACCOUNTS_PER_RUN - keys.length;
    if (remaining <= 0) break;
    const res = await db.prepare(sql).bind(cutoff, remaining).all<{ sync_key: string }>();
    for (const row of res.results) keys.push(row.sync_key);
  }
  return keys;
}

export async function runSyncCron(db: D1Database, scheduledTime: number = Date.now()): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS upstream_origin_policy (
      origin_key TEXT PRIMARY KEY,
      next_request_at INTEGER NOT NULL DEFAULT 0,
      cooldown_until INTEGER NOT NULL DEFAULT 0,
      cooldown_status INTEGER,
      challenge_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`,
  ).run();
  const now = scheduledTime;
  const tombstoneCutoff = now - TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pairingCutoff = Math.floor(now / 1000) - PAIRING_GRACE_DAYS * 24 * 60 * 60;
  const nowSeconds = Math.floor(now / 1000);
  const rateLimitCutoff = Math.floor(now / 1000) - RATE_LIMIT_MAX_WINDOW_SECONDS;

  await db.batch([
    db
      .prepare('DELETE FROM feeds WHERE deleted = 1 AND deleted_at < ?')
      .bind(tombstoneCutoff),
    db.prepare('DELETE FROM pairing_codes WHERE expires_at < ?').bind(pairingCutoff),
    db.prepare('DELETE FROM agent_connections WHERE expires_at < ?').bind(nowSeconds),
    db.prepare('DELETE FROM agent_approvals WHERE expires_at < ?').bind(nowSeconds),
    db.prepare('DELETE FROM verification WHERE expiresAt < ?').bind(new Date(now).toISOString()),
    db.prepare('DELETE FROM oauthClientAssertion WHERE expiresAt < ?').bind(new Date(now).toISOString()),
    db.prepare('DELETE FROM "user" WHERE id IN (SELECT g.user_id FROM agent_grants g JOIN "session" s ON s.userId = g.user_id WHERE s.expiresAt < ?)').bind(new Date(now).toISOString()),
    db.prepare(`DELETE FROM "user" WHERE id IN (SELECT g.user_id FROM agent_grants g WHERE ${ENDED_GRANT_SQL})`).bind(...endedGrantBindings(now)),
    db.prepare('DELETE FROM agent_grants WHERE user_id NOT IN (SELECT id FROM "user")'),
    db.prepare('DELETE FROM oauthClient WHERE clientId NOT IN (SELECT client_id FROM agent_grants) AND clientId NOT IN (SELECT client_id FROM agent_approvals) AND createdAt < ?').bind(new Date(now - 30 * 86_400_000).toISOString()),
    db.prepare('DELETE FROM oauthResource WHERE identifier NOT IN (SELECT resource FROM agent_grants) AND identifier LIKE ? AND identifier NOT IN (SELECT resourceId FROM oauthClientResource)').bind('%/mcp/c/%'),
    db
      .prepare('DELETE FROM rate_limits WHERE window_start < ?')
      .bind(rateLimitCutoff),
    db
      .prepare('DELETE FROM feed_fetch_failures WHERE retry_at < ?')
      .bind(now),
    db.prepare(
      'DELETE FROM upstream_origin_policy WHERE cooldown_until < ? AND next_request_at < ? AND updated_at < ?',
    ).bind(now, now, now - STATE_RETENTION_MS),
  ]);

  let retentionError: unknown;
  for (const syncKey of await expiredAccountKeys(db, Math.floor(now / 1000))) {
    try {
      await deleteAccount(db, syncKey, { rateLimits: false });
    } catch (err) {
      retentionError ??= err;
    }
  }

  // Touch the monotonic counter so a long-idle DB doesn't serve a stale "0".
  await currentMonotonicTime(db);
  if (retentionError !== undefined) throw retentionError;
}
