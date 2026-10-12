import { decodeJwt } from 'jose';

export const CODE_EXCHANGE_GRACE_SECONDS = 10 * 60;

export const ENDED_GRANT_SQL =
  'g.created_at < ? AND NOT EXISTS (SELECT 1 FROM oauthRefreshToken r WHERE r.userId = g.user_id AND r.revoked IS NULL AND r.expiresAt > ?)';

export function endedGrantBindings(now: number): [number, string] {
  return [Math.floor(now / 1000) - CODE_EXCHANGE_GRACE_SECONDS, new Date(now).toISOString()];
}

export function withOfflineAccess(scope: string): string {
  const scopes = scope.split(' ').filter(Boolean);
  if (scopes.includes('offline_access') || !scopes.some((value) => value === 'read' || value === 'write')) return scope;
  return [...scopes, 'offline_access'].join(' ');
}

export function requestedGrantType(contentType: string | null, body: ArrayBuffer): string | null {
  const text = new TextDecoder().decode(body);
  if (contentType?.includes('application/json')) {
    try {
      const parsed = JSON.parse(text) as { grant_type?: unknown };
      return typeof parsed.grant_type === 'string' ? parsed.grant_type : null;
    } catch {
      return null;
    }
  }
  return new URLSearchParams(text).get('grant_type');
}

export function registrationWithOfflineAccess(body: ArrayBuffer): ArrayBuffer {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body;
    const record = parsed as Record<string, unknown>;
    if (typeof record.scope !== 'string') return body;
    const scope = withOfflineAccess(record.scope);
    if (scope === record.scope) return body;
    return new TextEncoder().encode(JSON.stringify({ ...record, scope })).buffer as ArrayBuffer;
  } catch {
    return body;
  }
}

export async function extendSessionAfterRefresh(db: D1Database, response: Response): Promise<void> {
  if (!response.ok) return;
  try {
    const { access_token: accessToken } = await response.clone().json() as { access_token?: unknown };
    if (typeof accessToken !== 'string') return;
    const sessionId = decodeJwt(accessToken).sid;
    if (typeof sessionId !== 'string') return;
    const latest = 'SELECT MAX(expiresAt) FROM oauthRefreshToken WHERE sessionId = ? AND revoked IS NULL';
    await db.prepare(`UPDATE "session" SET expiresAt = (${latest}), updatedAt = ? WHERE id = ? AND expiresAt < (${latest})`)
      .bind(sessionId, new Date().toISOString(), sessionId, sessionId).run();
  } catch {
    console.warn(JSON.stringify({ event: 'oauth.session_extension_failed' }));
  }
}
