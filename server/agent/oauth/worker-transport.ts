import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import { validateUpstreamUrl } from '../../fetch';

export const fetchWorkerMetadata: ClientMetadataResourceFetch = async (input, init) => {
  const request = new Request(input, init);
  const url = await validateUpstreamUrl(request.url, request.signal);
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Metadata destination is not public');
  return fetch(url, { method: request.method, headers: request.headers, signal: request.signal, redirect: 'manual' });
};
