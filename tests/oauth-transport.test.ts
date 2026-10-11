import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { metadataTransport } from '../server/agent/oauth/transport';
import { fetchWorkerMetadata } from '../server/agent/oauth/worker-transport';
import { clearOriginGovernorForTests } from '../server/origin-governor';

const db = undefined as unknown as D1Database;
afterEach(() => { vi.unstubAllGlobals(); clearOriginGovernorForTests(); });

describe('OAuth metadata transport boundaries', () => {
  it('rejects non-HTTPS, credentials and fragments before fetching', async () => {
    const transport = vi.fn();
    const fetchMetadata = metadataTransport(db, transport);
    for (const url of ['http://example.com/client.json', 'https://user:pass@example.com/client.json', 'https://example.com/client.json#fragment']) {
      await expect(fetchMetadata(url)).rejects.toThrow();
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects private destinations on self-hosted and Worker transports', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const url of ['https://127.0.0.1/client.json', 'https://10.0.0.1/client.json', 'https://169.254.169.254/client.json']) {
      await expect(fetchClientMetadataResource(url)).rejects.toThrow();
      await expect(fetchWorkerMetadata(url)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests manual redirects and passes an abort deadline to the transport', async () => {
    const transport = vi.fn(async (_input, init) => {
      expect(init.redirect).toBe('manual');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/client.json' } });
    });
    expect((await metadataTransport(db, transport)('https://redirect.example/client.json')).status).toBe(302);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('bounds declared and streamed response sizes', async () => {
    const declared = metadataTransport(db, async () => new Response('too large', { headers: { 'content-length': '65537' } }));
    await expect(declared('https://declared.example/client.json')).rejects.toThrow('size limit');
    const streamed = metadataTransport(db, async () => new Response('x'.repeat(65537)));
    const response = await streamed('https://streamed.example/client.json');
    await expect(response.text()).rejects.toThrow();
  });
});
