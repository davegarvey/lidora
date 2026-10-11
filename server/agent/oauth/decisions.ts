import { Hono, type Context } from 'hono';
import { isPairingCode, requireMaster, getSyncKeyContext, clientIp, type SyncKeyEnv } from '../../sync/auth';
import { RATE_LIMITS, checkRateLimit } from '../../sync/ratelimit';
import { consentForAccount } from './provider';
import {
  CONNECTION_TTL_SECONDS,
  generateConnectionId,
  hostOf,
  isPrivateUseScheme,
  redirectDisplayHost,
  isConnectionId,
  noStore,
  nowSeconds,
  origin,
  rateLimited,
  usableUser,
  type OAuthContext,
} from './util';

interface RequestRow {
  request_id: string;
  approval_code: string;
  client_id: string;
  redirect_uri: string;
  signed_query: string;
  issuer: string;
  scopes: string;
  connection_id: string | null;
  decision: string | null;
  sync_key: string | null;
  created_at: number;
  expires_at: number;
  redirect_url: string | null;
}

type Status = 'pending' | 'approved' | 'denied' | 'expired';

const REQUEST_COLUMNS =
  'request_id, approval_code, client_id, redirect_uri, signed_query, issuer, scopes, connection_id, decision, sync_key, created_at, expires_at, redirect_url';

function redirectScheme(uri: string): string {
  try {
    return new URL(uri).protocol;
  } catch {
    return 'https:';
  }
}

function statusOf(row: RequestRow, now: number): Status {
  if (row.decision === 'approved') return 'approved';
  if (row.decision === 'denied') return 'denied';
  return row.expires_at <= now ? 'expired' : 'pending';
}

async function describeRequest(ctx: OAuthContext, row: RequestRow, now: number) {
  const client = await ctx.db
    .prepare('SELECT name AS client_name, clientDiscoveryId AS kind, uri AS client_uri FROM oauthClient WHERE clientId = ?')
    .bind(row.client_id)
    .first<{ client_name: string; kind: string; client_uri: string | null }>();
  return {
    status: statusOf(row, now),
    clientName: client?.client_name ?? hostOf(row.client_id) ?? 'Unknown client',
    unverified: !client?.kind || isPrivateUseScheme(redirectScheme(row.redirect_uri)),
    clientHost: hostOf(client?.client_uri),
    redirectHost: redirectDisplayHost(row.redirect_uri),
    scopes: row.scopes.split(' ').filter(Boolean),
    createdAt: row.created_at * 1000,
    expiresAt: row.expires_at * 1000,
  };
}

async function usableConnection(ctx: OAuthContext, connectionId: string | null, now: number) {
  if (!isConnectionId(connectionId)) return null;
  return ctx.db
    .prepare('SELECT sync_key, created_at FROM agent_connections WHERE connection_id = ? AND used_at IS NULL AND expires_at > ?')
    .bind(connectionId, now)
    .first<{ sync_key: string; created_at: number }>();
}

type Finalised = { ok: true; redirect: string } | { ok: false; status: 409 | 410 | 401; error: string };

async function finalise(
  ctx: OAuthContext,
  row: RequestRow,
  decision: 'approve' | 'deny',
  syncKey: string,
  requireConnection = false,
): Promise<Finalised> {
  const now = nowSeconds();
  const connection = row.connection_id
    ? await ctx.db.prepare('SELECT sync_key FROM agent_connections WHERE connection_id = ?').bind(row.connection_id).first<{ sync_key: string }>()
    : null;
  if ((connection && connection.sync_key !== syncKey) || (requireConnection && !(await usableConnection(ctx, row.connection_id, now)))) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  const decided = decision === 'approve' ? 'approved' : 'denied';
  const claim = await ctx.db
    .prepare('UPDATE agent_approvals SET decision = ?, sync_key = ? WHERE request_id = ? AND decision IS NULL AND expires_at > ?')
    .bind(decided, syncKey, row.request_id, now)
    .run();
  if (claim.meta.changes !== 1) {
    const current = await ctx.db
      .prepare('SELECT decision FROM agent_approvals WHERE request_id = ?')
      .bind(row.request_id)
      .first<{ decision: string | null }>();
    return current?.decision ? { ok: false, status: 409, error: 'already_decided' } : { ok: false, status: 410, error: 'expired' };
  }

  if (row.connection_id && decision === 'approve') {
    const used = await ctx.db
      .prepare('UPDATE agent_connections SET used_at = ? WHERE connection_id = ? AND used_at IS NULL AND expires_at > ?')
      .bind(now, row.connection_id, now)
      .run();
    if (used.meta.changes !== 1 && requireConnection) {
      await ctx.db
        .prepare('UPDATE agent_approvals SET decision = NULL, sync_key = NULL WHERE request_id = ?')
        .bind(row.request_id)
        .run();
      return { ok: false, status: 401, error: 'unauthorized' };
    }
  }

  const resource = row.connection_id
    ? `${new URL(row.issuer).origin}/mcp/c/${row.connection_id}`
    : `${new URL(row.issuer).origin}/mcp`;
  const redirect = await consentForAccount(ctx.provider(row.issuer), ctx.db, {
    syncKey, issuer: row.issuer, resource, clientId: row.client_id,
    scopes: row.scopes, signedQuery: row.signed_query, accept: decision === 'approve',
  });
  return { ok: true, redirect };
}

async function readDecision(c: Context): Promise<'approve' | 'deny' | null> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return null;
  }
  const decision = (body as { decision?: unknown } | null)?.decision;
  return decision === 'approve' || decision === 'deny' ? decision : null;
}

function normaliseCode(raw: string): string | null {
  const code = raw.toLowerCase().replace(/[\s-]/g, '');
  return isPairingCode(code) ? code : null;
}

export function createDecisionRoutes(ctx: OAuthContext): Hono<SyncKeyEnv> {
  const app = new Hono<SyncKeyEnv>();
  const masterAuth = requireMaster(ctx.db);

  const loadRequest = (requestId: string) =>
    ctx.db.prepare(`SELECT ${REQUEST_COLUMNS} FROM agent_approvals WHERE request_id = ?`).bind(requestId).first<RequestRow>();

  app.post('/sync/connections', async (c, next) => {
    await ctx.ready();
    return masterAuth(c, next);
  }, async (c) => {
    const { syncKey } = getSyncKeyContext(c);
    const scope = `connections:mint:${syncKey}`;
    const rl = await checkRateLimit(ctx.db, scope, RATE_LIMITS.connectionsMint.windowSeconds, RATE_LIMITS.connectionsMint.limit);
    if (!rl.ok) return rateLimited(c, rl.retryAfter);
    const now = nowSeconds();
    const connectionId = generateConnectionId();
    const expiresAt = now + CONNECTION_TTL_SECONDS;
    await ctx.db
      .prepare('INSERT INTO agent_connections (connection_id, sync_key, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(connectionId, syncKey, now, expiresAt)
      .run();
    noStore(c);
    return c.json({ connectionId, url: `${origin(c, ctx.publicUrl)}/mcp/c/${connectionId}`, expiresAt: expiresAt * 1000 });
  });

  app.get('/oauth/requests/:id', async (c) => {
    await ctx.ready();
    noStore(c);
    const row = await loadRequest(c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    const now = nowSeconds();
    const description = await describeRequest(ctx, row, now);
    const connection = await usableConnection(ctx, row.connection_id, now);
    let redirect: string | undefined;
    if (row.redirect_url && description.status !== 'pending' && description.status !== 'expired') {
      const taken = await ctx.db
        .prepare('UPDATE agent_approvals SET redirect_url = NULL WHERE request_id = ? AND redirect_url IS NOT NULL')
        .bind(row.request_id)
        .run();
      if (taken.meta.changes === 1) redirect = row.redirect_url;
    }
    return c.json({
      requestId: row.request_id,
      ...description,
      ...(description.status === 'pending' ? { approvalCode: row.approval_code } : {}),
      connection: { usable: connection !== null, createdAt: connection ? connection.created_at * 1000 : null },
      ...(redirect ? { redirect } : {}),
    });
  });

  app.use('/oauth/requests/:id/decision', async (c, next) => {
    await ctx.ready();
    if (c.req.header('X-Sync-Key') || c.req.header('Authorization')) return masterAuth(c, next);
    return next();
  });
  app.post('/oauth/requests/:id/decision', async (c) => {
    noStore(c);
    const decision = await readDecision(c);
    if (!decision) return c.json({ error: 'invalid_request' }, 400);
    const row = await loadRequest(c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    const now = nowSeconds();
    const status = statusOf(row, now);
    if (status === 'approved' || status === 'denied') return c.json({ error: 'already_decided' }, 409);
    if (status === 'expired') return c.json({ error: 'expired' }, 410);

    const master = c.get('syncKeyCtx');
    let syncKey: string;
    if (master) {
      const connection = await usableConnection(ctx, row.connection_id, now);
      if (connection && connection.sync_key !== master.syncKey) return c.json({ error: 'account_mismatch' }, 409);
      syncKey = master.syncKey;
    } else {
      const connection = await usableConnection(ctx, row.connection_id, now);
      if (!connection || !(await usableUser(ctx.db, connection.sync_key))) return c.json({ error: 'unauthorized' }, 401);
      syncKey = connection.sync_key;
    }
    const result = await finalise(ctx, row, decision, syncKey, !master);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ redirect: result.redirect });
  });

  app.use('/oauth/approvals/:code', masterAuth);
  app.use('/oauth/approvals/:code/decision', masterAuth);

  const lookupByCode = async (c: Context<SyncKeyEnv>): Promise<{ row: RequestRow; syncKey: string } | Response> => {
    await ctx.ready();
    noStore(c);
    const { syncKey } = getSyncKeyContext(c);
    const byIp = await checkRateLimit(ctx.db, `approval:ip:${clientIp(c)}`, RATE_LIMITS.approvalLookupIp.windowSeconds, RATE_LIMITS.approvalLookupIp.limit);
    if (!byIp.ok) return rateLimited(c, byIp.retryAfter);
    const byKey = await checkRateLimit(ctx.db, `approval:key:${syncKey}`, RATE_LIMITS.approvalLookupKey.windowSeconds, RATE_LIMITS.approvalLookupKey.limit);
    if (!byKey.ok) return rateLimited(c, byKey.retryAfter);
    const code = normaliseCode(c.req.param('code') ?? '');
    const row = code
      ? await ctx.db.prepare(`SELECT ${REQUEST_COLUMNS} FROM agent_approvals WHERE approval_code = ?`).bind(code).first<RequestRow>()
      : null;
    if (!row) return c.json({ error: 'not_found' }, 404);
    return { row, syncKey };
  };

  app.get('/oauth/approvals/:code', async (c) => {
    const found = await lookupByCode(c);
    if (found instanceof Response) return found;
    return c.json(await describeRequest(ctx, found.row, nowSeconds()));
  });

  app.post('/oauth/approvals/:code/decision', async (c) => {
    const found = await lookupByCode(c);
    if (found instanceof Response) return found;
    const decision = await readDecision(c);
    if (!decision) return c.json({ error: 'invalid_request' }, 400);
    const { row, syncKey } = found;
    const status = statusOf(row, nowSeconds());
    if (status === 'approved' || status === 'denied') return c.json({ error: 'already_decided' }, 409);
    if (status === 'expired') return c.json({ error: 'expired' }, 410);
    const result = await finalise(ctx, row, decision, syncKey);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await ctx.db
      .prepare('UPDATE agent_approvals SET redirect_url = ? WHERE request_id = ?')
      .bind(result.redirect, row.request_id)
      .run();
    return c.json({ status: decision === 'approve' ? 'approved' : 'denied' });
  });

  return app;
}

