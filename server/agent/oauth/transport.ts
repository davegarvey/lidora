import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import { capBody, declaredLengthExceeds } from '../../body-cap';
import { fetchOriginRequest } from '../../origin-governor';

export function metadataTransport(db: D1Database, transport: ClientMetadataResourceFetch): ClientMetadataResourceFetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new Error('Invalid metadata URL');
    const response = await fetchOriginRequest(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]),
    }, { db, route: 'discovery' }, async (input, init) => transport(input, init));
    if (declaredLengthExceeds(response.headers, 64 * 1024)) {
      await response.body?.cancel();
      throw new Error('Metadata exceeds size limit');
    }
    return new Response(capBody(response.body, 64 * 1024), { status: response.status, headers: response.headers });
  };
}
