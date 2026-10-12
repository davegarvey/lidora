import { createLocalJWKSet, decodeJwt, jwtVerify } from 'jose';
import { parseScopes, type TokenAuth } from '../../sync/auth';
import { publicOrigin } from '../origin';
import { createProvider, type MetadataFetch } from './provider';

export type OAuthAuthenticator = (token: string, requestUrl: string) => Promise<TokenAuth | null>;

export function oauthAuthenticator(db: D1Database, secret: string | undefined, transport: MetadataFetch, publicUrl?: string): OAuthAuthenticator {
  return async (token, requestUrl) => {
    if (!secret || secret.length < 32 || token.length > 16_384 || token.split('.').length !== 3) return null;
    const base = publicOrigin(requestUrl, publicUrl);
    try {
      const decoded = decodeJwt(token);
      const issuer = decoded.iss;
      if (typeof issuer !== 'string') return null;
      const path = issuer.slice(base.length);
      if (!issuer.startsWith(base) || !/^\/oauth(?:\/c\/[A-Za-z0-9_-]{32})?$/.test(path)) return null;
      const auth = createProvider(db, base, secret, transport, path.split('/')[3]);
      const keys = await auth.api.getJwks();
      const { payload } = await jwtVerify(token, createLocalJWKSet(keys), { issuer, audience: `${base}/mcp${path.startsWith('/oauth/c/') ? `/c/${path.split('/')[3]}` : ''}` });
      if (payload.cnf || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      const grant = await db.prepare(
        'SELECT g.token_id, g.sync_key, g.scopes, g.resource, g.last_seen_minute, s.expiresAt ' +
        'FROM agent_grants g JOIN users u ON u.sync_key = g.sync_key JOIN "session" s ON s.userId = g.user_id ' +
        'JOIN oauthClient c ON c.clientId = g.client_id ' +
        'WHERE g.user_id = ? AND g.issuer = ? AND u.rotated_at IS NULL AND s.id = ? AND (c.disabled IS NULL OR c.disabled = 0)',
      ).bind(payload.sub, issuer, payload.sid).first<{
        token_id: string; sync_key: string; scopes: string; resource: string; last_seen_minute: number | null; expiresAt: number | string;
      }>();
      if (!grant || new Date(grant.expiresAt).getTime() <= Date.now()) return null;
      const requestPath = new URL(requestUrl).pathname;
      if (requestPath.startsWith('/mcp') && `${base}${requestPath}` !== grant.resource) return null;
      const refresh = await db.prepare('SELECT expiresAt, revoked FROM oauthRefreshToken WHERE userId = ?').bind(payload.sub).all<{ expiresAt: number | string; revoked: number | string | null }>();
      if (!refresh.results.some((row) => row.revoked === null && new Date(row.expiresAt).getTime() > Date.now())) return null;
      const scopes = parseScopes(typeof payload.scope === 'string' ? payload.scope : '').filter((scope) => parseScopes(grant.scopes).includes(scope));
      const minute = Math.floor(Date.now() / 60_000);
      if (grant.last_seen_minute !== minute) await db.prepare('UPDATE agent_grants SET last_seen_at = ?, last_seen_minute = ? WHERE token_id = ?').bind(Date.now(), minute, grant.token_id).run();
      return { syncKey: grant.sync_key, tokenId: grant.token_id, scopes };
    } catch {
      return null;
    }
  };
}
