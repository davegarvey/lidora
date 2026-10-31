import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFeedResponsive } from './parse';

class ParserWorker {
  static message: unknown;
  static wasTerminated = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  message: unknown;
  postMessage(message: unknown) { ParserWorker.message = message; queueMicrotask(() => this.onmessage?.({ data: { title: 'Parsed in worker', items: [] } } as MessageEvent)); }
  terminate() { ParserWorker.wasTerminated = true; }
}

afterEach(() => vi.unstubAllGlobals());

describe('parseFeedResponsive', () => {
  it('hands XML parsing to a module worker and returns its result', async () => {
    ParserWorker.message = undefined;
    ParserWorker.wasTerminated = false;
    vi.stubGlobal('Worker', class extends ParserWorker {});
    const result = await parseFeedResponsive('<rss/>', 'https://example.com/feed');
    expect(result?.title).toBe('Parsed in worker');
    expect(ParserWorker.message).toEqual({ xml: '<rss/>', baseUrl: 'https://example.com/feed' });
    expect(ParserWorker.wasTerminated).toBe(true);
  });

  it('rejects worker failures instead of repeating a long parse on the UI thread', async () => {
    vi.stubGlobal('Worker', class extends ParserWorker {
      postMessage() { queueMicrotask(() => this.onerror?.({ message: 'worker failed' } as ErrorEvent)); }
    });
    await expect(parseFeedResponsive('<rss/>')).rejects.toThrow('worker failed');
  });
});
