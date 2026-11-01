import type { FeedReadSample } from '../articles/feedRanking';
import type { Item } from './types';
import { getDb } from './open';

const RECENT_COHORT_MS = 90 * 24 * 60 * 60 * 1000;
const MATURITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MATURE_ARTICLES_PER_FEED = 200;

export async function listRecentFeedReadSamples(feedIds: readonly string[], now = Date.now()): Promise<FeedReadSample[]> {
  if (feedIds.length === 0) return [];
  const db = await getDb();
  const tx = db.transaction(['items', 'readMarkers'], 'readonly');
  const items = tx.objectStore('items');
  const markers = tx.objectStore('readMarkers');
  const oldest = now - RECENT_COHORT_MS;
  const newestMature = now - MATURITY_WINDOW_MS;
  const cohorts = await Promise.all(feedIds.map(async (feedId) => {
    const cohort: Item[] = [];
    let cursor = await items.index('by-feed-created').openCursor(
      IDBKeyRange.bound([feedId, oldest], [feedId, newestMature]),
      'prev',
    );
    while (cursor && cohort.length < MAX_MATURE_ARTICLES_PER_FEED) {
      cohort.push(cursor.value);
      cursor = await cursor.continue();
    }
    return { feedId, items: cohort };
  }));
  const samples = await Promise.all(cohorts.map(async ({ feedId, items: cohort }) => {
    const markerKeys = await Promise.all(cohort.map((item) => markers.getKey(item.id)));
    return {
      feedId,
      articles: cohort.length,
      read: markerKeys.filter((key) => key !== undefined).length,
    };
  }));
  await tx.done;
  return samples;
}
