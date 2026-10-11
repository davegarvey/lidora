import { betterAuth } from 'better-auth';
import { anonymous, jwt } from 'better-auth/plugins';
import { cimd } from '@better-auth/cimd';
import { mcp } from '@better-auth/mcp';
import { tokenFingerprint } from '../../sync/tokens';

export type MetadataFetch = import('@better-auth/oauth-provider').ClientMetadataResourceFetch;

export function createProvider(db: D1Database, base: string, secret: string, fetchMetadata: MetadataFetch, connectionId?: string) {
  const path = connectionId ? `/oauth/c/${connectionId}` : '/oauth';
  const resource = connectionId ? `${base}/mcp/c/${connectionId}` : `${base}/mcp`;
  return betterAuth({
    baseURL: base,
    basePath: path,
    secret,
    database: db,
    telemetry: { enabled: false },
    logger: { disabled: true },
    session: { expiresIn: 365 * 24 * 60 * 60 },
    plugins: [
      jwt(),
      anonymous(),
      mcp({
        resource,
        loginPage: `${base}${path}/start`,
        consentPage: `${base}${path}/start`,
        scopes: ['read', 'write', 'offline_access'],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        allowPublicClientPrelogin: true,
        refreshTokenReuseInterval: 0,
        dpop: { signingAlgorithms: [] },
        accessTokenExpiresIn: 60 * 60,
        refreshTokenExpiresIn: 365 * 24 * 60 * 60,
      }),
      cimd({ metadataProfile: 'mcp-2026-07-28', fetchClientMetadataResource: fetchMetadata }),
    ],
  });
}

export type Provider = ReturnType<typeof createProvider>;

export async function consentForAccount(auth: Provider, db: D1Database, input: {
  syncKey: string; issuer: string; resource: string; clientId: string; scopes: string; signedQuery: string; accept: boolean;
}): Promise<string> {
  const login = await auth.api.signInAnonymous({ asResponse: true });
  if (!login.ok) throw new Error('Could not establish agent identity');
  const { user } = await login.json() as { user: { id: string } };
  try {
    const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    if (input.accept) {
      const tokenId = crypto.randomUUID();
      const inserted = await db.prepare('INSERT INTO agent_grants (token_id, user_id, sync_key, issuer, resource, client_id, fingerprint, scopes, created_at) SELECT ?, ?, sync_key, ?, ?, ?, ?, ?, ? FROM users WHERE sync_key = ? AND rotated_at IS NULL')
        .bind(tokenId, user.id, input.issuer, input.resource, input.clientId, await tokenFingerprint(tokenId), input.scopes, Math.floor(Date.now() / 1000), input.syncKey).run();
      if (inserted.meta.changes !== 1) throw new Error('Account is no longer available');
    }
    const consent = await auth.handler(new Request(`${input.issuer}/oauth2/consent`, {
      method: 'POST',
      headers: { cookie, origin: new URL(input.issuer).origin, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ accept: input.accept, oauth_query: input.signedQuery }),
    }));
    if (!consent.ok) throw new Error('Could not complete consent');
    const result = await consent.json() as { url: string };
    if (!input.accept) await db.prepare('DELETE FROM "user" WHERE id = ?').bind(user.id).run();
    return result.url;
  } catch (error) {
    await db.batch([
      db.prepare('DELETE FROM agent_grants WHERE user_id = ?').bind(user.id),
      db.prepare('DELETE FROM "user" WHERE id = ?').bind(user.id),
    ]);
    throw error;
  }
}
