import type { MetadataFetch } from './agent/oauth/provider';
import { oauthAuthenticator } from './agent/oauth/authenticate';
import { Hono, type Env, type MiddlewareHandler } from 'hono';
import {
  getUpstreamUrl,
  fetchUpstreamWithPolicy,
  fetchFeedCached,
  cancelResponse,
  badRequest,
  badGateway,
} from './fetch';
import { assertNoUrlLog } from './log';
import { ARTICLE_MAX_BYTES, FEED_MAX_BYTES, IMAGE_MAX_BYTES, capBody, declaredLengthExceeds } from './body-cap';
import { proxyGuard, type ProxyGuardOptions } from './proxy-guard';
import { createSyncRoutes } from './sync/routes';
import { createOAuthRoutes } from './agent/oauth';
import { createMcpRoutes } from './agent/mcp';

export type AppEnv = Env;

const PROXY_CSP = "default-src 'none'; sandbox";
const IMAGE_CSP = 'sandbox';

function sniffImageContentType(bytes: Uint8Array): string | undefined {
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (text(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif';
  if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') return 'image/webp';
  if (text(0, 2) === 'BM') return 'image/bmp';
  if (text(0, 4) === 'II*\0' || text(0, 4) === 'MM\0*') return 'image/tiff';
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'image/x-icon';
  if (text(4, 4) === 'ftyp' && (text(8, 4) === 'avif' || text(8, 4) === 'avis')) return 'image/avif';
  return undefined;
}

async function inspectOctetStreamImage(body: ReadableStream<Uint8Array<ArrayBufferLike>> | null): Promise<{
  body: ReadableStream<Uint8Array<ArrayBufferLike>>;
  contentType: string;
} | null> {
  if (!body) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (byteLength < 12) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      byteLength += value.byteLength;
      if (byteLength > IMAGE_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
    }
  } catch {
    await reader.cancel();
    return null;
  }

  const prefix = new Uint8Array(Math.min(byteLength, 12));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = prefix.length - offset;
    if (remaining <= 0) break;
    const length = Math.min(chunk.length, remaining);
    prefix.set(chunk.subarray(0, length), offset);
    offset += length;
  }
  const contentType = sniffImageContentType(prefix);
  if (!contentType) {
    await reader.cancel();
    return null;
  }

  const restoredBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = chunks.shift();
      if (chunk) {
        controller.enqueue(chunk);
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        reader.releaseLock();
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
  return { body: restoredBody, contentType };
}

function isolateProxyResponse(csp: string): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.set('Content-Security-Policy', csp);
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
  };
}

function proxyError(response: Response): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
  for (const name of ['Retry-After', 'X-Lidora-Retry-After', 'X-Lidora-Request-Source', 'X-Lidora-Cache']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export interface CreateAppOptions {
  proxy?: ProxyGuardOptions;
  db?: D1Database;
  pollDb?: D1Database;
  publicUrl?: string;
  oauthSecret?: string;
  oauthMetadataFetch?: MetadataFetch;
  scheduledHandler?: (event: { scheduledTime: Date; waitUntil?: (p: Promise<unknown>) => void }) => Promise<void>;
}

export function createApp<E extends Env = AppEnv>(options: CreateAppOptions = {}): Hono<E> {
  const { db, pollDb, publicUrl, scheduledHandler, proxy } = options;
  const app = new Hono<E>();

  app.use('/feed', isolateProxyResponse(PROXY_CSP));
  app.use('/article', isolateProxyResponse(PROXY_CSP));
  app.use('/img', isolateProxyResponse(IMAGE_CSP));
  app.use('/feed', proxyGuard('feed', proxy));
  app.use('/article', proxyGuard('article', proxy));
  app.use('/img', proxyGuard('image', proxy));

  /**
   * GET /feed?url=<encoded>
   * Stateless proxy: fetches an upstream RSS/Atom/RDF feed and pipes the body
   * back to the browser. Forwards conditional headers (If-None-Match /
   * If-Modified-Since) and passes through 304 responses. Never logs the URL.
   */
  app.get('/feed', async (c) => {
    const upstream = await getUpstreamUrl(c.req.url);
    if (!upstream) return badRequest('Missing or invalid `url` query parameter');
    assertNoUrlLog(upstream);

    const inm = c.req.header('If-None-Match');
    const ims = c.req.header('If-Modified-Since');

    let feedResult: Awaited<ReturnType<typeof fetchFeedCached>>;
    try {
      feedResult = await fetchFeedCached(upstream, {
        etag: inm ?? undefined,
        lastModified: ims ?? undefined,
      }, db);
    } catch {
      return badGateway('Failed to fetch upstream feed');
    }

    const upstreamRes = feedResult.response;

    if (upstreamRes.status !== 304 && declaredLengthExceeds(upstreamRes.headers, FEED_MAX_BYTES)) {
      void cancelResponse(upstreamRes);
      return badGateway('Upstream response is too large');
    }

    // Pass through 304 with no body.
    const retryAfter = upstreamRes.headers.get('X-Lidora-Retry-After');

    if (upstreamRes.status === 304) {
      const headers = new Headers({
        ETag: upstreamRes.headers.get('ETag') ?? '',
        'Last-Modified': upstreamRes.headers.get('Last-Modified') ?? '',
        Age: upstreamRes.headers.get('Age') ?? '0',
        'X-Lidora-Cache': upstreamRes.headers.get('X-Lidora-Cache') ?? feedResult.state,
        'X-Lidora-Request-Source': upstreamRes.headers.get('X-Lidora-Request-Source') ?? 'feed-cache',
      });
      if (retryAfter) headers.set('X-Lidora-Retry-After', retryAfter);
      const permanentRedirectUrl = upstreamRes.headers.get('X-Lidora-Permanent-Redirect');
      if (permanentRedirectUrl) headers.set('X-Lidora-Permanent-Redirect', permanentRedirectUrl);
      return new Response(null, { status: 304, headers });
    }

    // For non-2xx (other than 304), return the upstream status to the client.
    if (upstreamRes.status < 200 || upstreamRes.status >= 300) {
      return proxyError(new Response(capBody(upstreamRes.body, FEED_MAX_BYTES), {
        status: upstreamRes.status,
        headers: upstreamRes.headers,
      }));
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/xml; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store');
    headers.set('Age', upstreamRes.headers.get('Age') ?? '0');
    headers.set('X-Lidora-Cache', upstreamRes.headers.get('X-Lidora-Cache') ?? feedResult.state);
    headers.set('X-Lidora-Request-Source', upstreamRes.headers.get('X-Lidora-Request-Source') ?? 'upstream');
    const etagHeader = upstreamRes.headers.get('ETag');
    if (etagHeader) headers.set('ETag', etagHeader);
    const lastModified = upstreamRes.headers.get('Last-Modified');
    if (lastModified) headers.set('Last-Modified', lastModified);
    if (retryAfter) headers.set('X-Lidora-Retry-After', retryAfter);
    const permanentRedirectUrl = upstreamRes.headers.get('X-Lidora-Permanent-Redirect');
    if (permanentRedirectUrl) headers.set('X-Lidora-Permanent-Redirect', permanentRedirectUrl);
    return new Response(capBody(upstreamRes.body, FEED_MAX_BYTES), { status: 200, headers });
  });

  /**
   * GET /article?url=<encoded>
   * Stateless proxy: fetches an upstream article HTML and pipes it back. The
   * browser runs Readability on the result. Never logs the URL.
   */
  app.get('/article', async (c) => {
    const upstream = await getUpstreamUrl(c.req.url);
    if (!upstream) return badRequest('Missing or invalid `url` query parameter');
    assertNoUrlLog(upstream);

    let upstreamRes: Response;
    try {
      upstreamRes = await fetchUpstreamWithPolicy(upstream, {}, { db, route: 'article' });
    } catch {
      const response = badGateway('Failed to fetch upstream article');
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Lidora-Request-Source', 'local-gate');
      return response;
    }

    if (declaredLengthExceeds(upstreamRes.headers, ARTICLE_MAX_BYTES)) {
      void cancelResponse(upstreamRes);
      return badGateway('Upstream response is too large');
    }

    if (upstreamRes.status < 200 || upstreamRes.status >= 300) {
      return proxyError(new Response(capBody(upstreamRes.body, ARTICLE_MAX_BYTES), {
        status: upstreamRes.status,
        headers: upstreamRes.headers,
      }));
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store');
    headers.set('X-Lidora-Request-Source', upstreamRes.headers.get('X-Lidora-Request-Source') ?? 'upstream');
    const etagHeader = upstreamRes.headers.get('ETag');
    if (etagHeader) headers.set('ETag', etagHeader);
    const lastModified = upstreamRes.headers.get('Last-Modified');
    if (lastModified) headers.set('Last-Modified', lastModified);
    return new Response(capBody(upstreamRes.body, ARTICLE_MAX_BYTES), { status: upstreamRes.status, headers });
  });

  /**
   * GET /img?url=<encoded>
   * Stateless single-shot image proxy: fetches an upstream image and pipes it
   * back with its original Content-Type. Non-image responses are refused. Used
   * by the browser to inline images as data: URIs in extracted article HTML.
   * Never logs the URL.
   */
  app.get('/img', async (c) => {
    const upstream = await getUpstreamUrl(c.req.url);
    if (!upstream) return badRequest('Missing or invalid `url` query parameter');
    assertNoUrlLog(upstream);

    let upstreamRes: Response;
    try {
      upstreamRes = await fetchUpstreamWithPolicy(upstream, {}, { db, route: 'image' });
    } catch {
      const response = badGateway('Failed to fetch upstream image');
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Lidora-Request-Source', 'local-gate');
      return response;
    }

    if (declaredLengthExceeds(upstreamRes.headers, IMAGE_MAX_BYTES)) {
      void cancelResponse(upstreamRes);
      return badGateway('Upstream response is too large');
    }

    if (upstreamRes.status < 200 || upstreamRes.status >= 300) {
      return proxyError(new Response(capBody(upstreamRes.body, IMAGE_MAX_BYTES), {
        status: upstreamRes.status,
        headers: upstreamRes.headers,
      }));
    }

    let contentType = upstreamRes.headers.get('Content-Type')?.trim();
    let body: ReadableStream<Uint8Array<ArrayBufferLike>> | null = upstreamRes.body;
    if (contentType?.toLowerCase().split(';', 1)[0] === 'application/octet-stream') {
      const inspected = await inspectOctetStreamImage(body);
      if (inspected) {
        body = inspected.body;
        contentType = inspected.contentType;
      } else {
        contentType = undefined;
      }
    }
    if (!contentType || !/^image\//i.test(contentType)) {
      void cancelResponse(upstreamRes);
      return badGateway('Upstream response is not an image');
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=2592000, immutable');
    headers.set('X-Lidora-Request-Source', upstreamRes.headers.get('X-Lidora-Request-Source') ?? 'upstream');
    return new Response(capBody(body, IMAGE_MAX_BYTES), { status: upstreamRes.status, headers });
  });

  // Sync routes — only registered when a D1 binding is provided.
  if (db) {
    const fetchMetadata = options.oauthMetadataFetch ?? (() => { throw new Error('OAuth metadata transport is not configured'); });
    const oauth = oauthAuthenticator(db, options.oauthSecret, fetchMetadata, publicUrl);
    app.route('/', createOAuthRoutes({ db, publicUrl, secret: options.oauthSecret, fetchMetadata }));
    app.use('/connect', async (c, next) => {
      await next();
      c.res = new Response(c.res.body, c.res);
      c.res.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    });
    app.route('/', createMcpRoutes({ db, pollDb, publicUrl, oauth }));
    const syncApp = createSyncRoutes(db, { pollDb, oauth });
    app.route('/', syncApp);
    if (scheduledHandler) {
      // Mount scheduled handler as a module-level export so worker.ts can hook it.
      (app as unknown as { __scheduledHandler?: typeof scheduledHandler }).__scheduledHandler = scheduledHandler; // why: stashing handler on Hono app; not in public types
    }
  }

  if (db) {
    for (const prefix of ['/oauth/*', '/.well-known/*', '/mcp/*', '/sync/*']) {
      app.all(prefix, (c) => c.json({ error: 'not_found' }, 404));
    }
  }

  // Static serving: served by adapter-supplied middleware below.
  // The adapter calls `app.use('/assets/*', serveStatic(...))` and
  // `app.get('/', serveStatic({ path: './index.html' }))` for its runtime.
  // We expose the app here so adapters can register static routes.
  return app;
}

/**
 * Default app: for environments that don't need static serving (e.g., the
 * Hono app without adapters). Adapters should call `createApp()` directly
 * and chain their own static-serve middleware after the proxy routes.
 */
export const app = createApp();
