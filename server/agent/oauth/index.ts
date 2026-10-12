import { capBody, declaredLengthExceeds } from '../../body-cap';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import { generatePairingCode } from '../../sync/auth';
import { ensureSchema } from '../../sync/schema';
import { RATE_LIMITS } from '../../sync/ratelimit';
import { publicOrigin } from '../origin';
import { createDecisionRoutes } from './decisions';
import { extendSessionAfterRefresh, registrationWithOfflineAccess, requestedGrantType, withOfflineAccess } from './lifetime';
import { createProvider } from './provider';
import { metadataTransport } from './transport';
import { errorPage, isConnectionId, limitByIp, noStore, randomId, type OAuthContext } from './util';

export interface OAuthRoutesOptions {
  db: D1Database;
  publicUrl?: string;
  secret?: string;
  fetchMetadata: ClientMetadataResourceFetch;
}

export function createOAuthRoutes({ db, publicUrl, secret, fetchMetadata }: OAuthRoutesOptions): Hono {
  let schemaReady: Promise<void> | null = null;
  const ctx: OAuthContext = {
    db, publicUrl,
    ready: () => schemaReady ??= ensureSchema(db),
    provider: (issuer) => {
      if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
      const url = new URL(issuer);
      const id = url.pathname.split('/')[3];
      return createProvider(db, url.origin, secret, metadataTransport(db, fetchMetadata), id);
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (!c.req.path.startsWith('/oauth/') && !c.req.path.startsWith('/.well-known/') && c.req.path !== '/sync/connections') return next();
    if (!secret || secret.length < 32) return c.json({ error: 'oauth_not_configured' }, 503);
    await ctx.ready();
    noStore(c);
    if (c.req.method === 'POST' && c.req.header('Origin') && c.req.header('Origin') !== publicOrigin(c.req.url, publicUrl)
      && !/\/oauth2\/(register|token|revoke)$/.test(c.req.path)) return c.json({ error: 'forbidden' }, 403);
    return next();
  });
  const crossOrigin = cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version'], maxAge: 86400 });
  app.use('/.well-known/*', crossOrigin);
  app.use('/oauth/*/oauth2/*', crossOrigin);
  app.use('/oauth/oauth2/*', crossOrigin);

  const providerForRequest = (url: string, id?: string) => ctx.provider(`${publicOrigin(url, publicUrl)}/oauth${id ? `/c/${id}` : ''}`);
  const protocol = async (c: Context) => {
    const id = c.req.param('id');
    if (id !== undefined && !isConnectionId(id)) return c.json({ error: 'not_found' }, 404);
    const requestUrl = new URL(c.req.url);
    const canonical = new URL(publicOrigin(c.req.url, publicUrl));
    requestUrl.protocol = canonical.protocol;
    requestUrl.host = canonical.host;
    if (requestUrl.pathname.endsWith('/oauth2/authorize') && !requestUrl.searchParams.has('resource')) {
      requestUrl.searchParams.set('resource', `${canonical.origin}/mcp${id ? `/c/${id}` : ''}`);
    }
    const scope = requestUrl.searchParams.get('scope');
    if (requestUrl.pathname.endsWith('/oauth2/authorize') && scope !== null) requestUrl.searchParams.set('scope', withOfflineAccess(scope));
    const headers = new Headers(c.req.raw.headers);
    headers.delete('cookie');
    if (declaredLengthExceeds(c.req.raw.headers, 16 * 1024)) return c.json({ error: 'invalid_request' }, 413);
    let body: ArrayBuffer | undefined;
    try {
      if (c.req.method === 'POST') body = await new Response(capBody(c.req.raw.body, 16 * 1024)).arrayBuffer();
    } catch {
      return c.json({ error: 'invalid_request' }, 413);
    }
    if (body && requestUrl.pathname.endsWith('/oauth2/register')) {
      body = registrationWithOfflineAccess(body);
      headers.delete('content-length');
    }
    const auth = providerForRequest(c.req.url, id);
    const response = await auth.handler(new Request(requestUrl, { method: c.req.method, headers, body }));
    if (body && requestUrl.pathname.endsWith('/oauth2/token') && requestedGrantType(headers.get('content-type'), body) === 'refresh_token') {
      await extendSessionAfterRefresh(db, response);
    }
    return response;
  };
  for (const prefix of ['/oauth', '/oauth/c/:id']) {
    for (const endpoint of ['register', 'token', 'revoke']) {
      app.options(`${prefix}/oauth2/${endpoint}`, crossOrigin);
      app.post(`${prefix}/oauth2/${endpoint}`, crossOrigin, async (c) => {
        const limited = await limitByIp(ctx, c, `oauth:${endpoint}`, endpoint === 'register' ? RATE_LIMITS.oauthRegister : RATE_LIMITS.oauthToken);
        if (limited !== null) return c.json({ error: 'rate_limited' }, 429, { 'Retry-After': String(limited) });
        return protocol(c);
      });
    }
    app.get(`${prefix}/oauth2/authorize`, async (c) => {
      const limited = await limitByIp(ctx, c, 'oauth:authorize', RATE_LIMITS.oauthAuthorize);
      if (limited !== null) return errorPage(c, 'Too many authorisation attempts. Try again shortly.', 429);
      return protocol(c);
    });
    app.get(`${prefix}/jwks`, protocol);
    app.get(`${prefix}/start`, async (c) => {
      const limited = await limitByIp(ctx, c, 'oauth:start', RATE_LIMITS.oauthAuthorize);
      if (limited !== null) return errorPage(c, 'Too many authorisation attempts. Try again shortly.', 429);
      const id = c.req.param('id');
      if (id !== undefined && !isConnectionId(id)) return c.json({ error: 'not_found' }, 404);
      const base = publicOrigin(c.req.url, publicUrl);
      const issuer = `${base}/oauth${id ? `/c/${id}` : ''}`;
      const signedQuery = new URL(c.req.url).search.slice(1);
      const query = new URLSearchParams(signedQuery);
      const clientId = query.get('client_id') ?? '';
      const resource = `${base}/mcp${id ? `/c/${id}` : ''}`;
      if (query.getAll('resource').length !== 1 || query.get('resource') !== resource) return errorPage(c, 'This request does not identify the Sift connection. Start again from your agent.');
      const auth = ctx.provider(issuer);
      try {
        await auth.api.getOAuthClientPublicPrelogin({ body: { client_id: clientId, oauth_query: signedQuery } });
      } catch {
        return errorPage(c, 'The authorisation request is invalid or has expired. Start again from your agent.');
      }
      const requestId = randomId(32);
      const now = Math.floor(Date.now() / 1000);
      await db.prepare('INSERT INTO agent_approvals (request_id, approval_code, client_id, redirect_uri, scopes, signed_query, issuer, connection_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(requestId, generatePairingCode(), clientId, query.get('redirect_uri'), query.get('scope') ?? '', signedQuery, issuer, id ?? null, now, Math.min(now + 600, Number(query.get('exp')))).run();
      return c.redirect(`${base}/connect?request=${requestId}`, 302);
    });
  }
  app.get('/.well-known/oauth-protected-resource', protocol);
  app.get('/.well-known/oauth-protected-resource/mcp', protocol);
  app.get('/.well-known/oauth-protected-resource/mcp/c/:id', protocol);
  app.get('/.well-known/oauth-authorization-server/oauth', protocol);
  app.get('/.well-known/oauth-authorization-server/oauth/c/:id', protocol);
  app.route('/', createDecisionRoutes(ctx));
  return app;
}
