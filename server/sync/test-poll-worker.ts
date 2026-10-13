/**
 * Worker entry point for feed-polling integration tests: the sync routes
 * plus the scheduled handlers, run against Miniflare + real SQLite D1.
 */
import syncWorker from './test-worker';
import { runSyncCron } from './cron';
import { parsePollBatch, parsePositiveInt, pollFeeds, DEFAULT_MAX_POLL_DB_BYTES } from '../feed-poller';
import { clearFeedCacheForTests } from '../fetch';

interface Env {
  DB: D1Database;
  POLL_DB: D1Database;
  FEED_POLLING?: string;
  FEED_POLL_BATCH?: string;
  POLL_DB_MAX_BYTES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/__test/clear-feed-cache') {
      const feedUrl = url.searchParams.get('url');
      const cacheStorage = caches as CacheStorage & { default: Cache };
      if (feedUrl) await cacheStorage.default.delete(new Request(feedUrl));
      clearFeedCacheForTests();
      return new Response(null, { status: 204 });
    }
    return syncWorker.fetch(request, env);
  },
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    if (event.cron === '0 3 * * *') {
      await runSyncCron(env.DB, event.scheduledTime);
      return;
    }
    if (env.FEED_POLLING === 'true') {
      await pollFeeds(env.DB, env.POLL_DB, {
        batch: parsePollBatch(env.FEED_POLL_BATCH),
        maxDbBytes: parsePositiveInt(env.POLL_DB_MAX_BYTES, DEFAULT_MAX_POLL_DB_BYTES),
      });
    }
  },
};
