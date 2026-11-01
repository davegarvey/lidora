import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/open';
import { listRecentFeedReadSamples } from '../src/db/feed-ranking';
import type { Item } from '../src/db/types';

function item(id: string, feedId: string, createdAt: number): Item {
  return { id, feedId, guid: id, title: id, excerpt: '', publishedAt: createdAt, updatedAt: createdAt, createdAt, read: false, starred: false };
}

beforeEach(async () => {
  const db = await getDb();
  await db.clear('items');
  await db.clear('readMarkers');
});

describe('recent feed read samples', () => {
  it('counts read-once markers in the mature 14-to-90-day first-seen cohort', async () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const db = await getDb();
    const values = [
      item('read-a', 'a', now - 30 * 24 * 60 * 60 * 1000),
      item('unread-a', 'a', now - 20 * 24 * 60 * 60 * 1000),
      item('new-a', 'a', now - 5 * 24 * 60 * 60 * 1000),
      item('old-a', 'a', now - 100 * 24 * 60 * 60 * 1000),
      item('read-b', 'b', now - 45 * 24 * 60 * 60 * 1000),
    ];
    for (const value of values) await db.put('items', value);
    await db.put('readMarkers', { id: 'read-a', feedId: 'a', acknowledged: 1 });
    await db.put('readMarkers', { id: 'read-b', feedId: 'b', acknowledged: 1 });

    await expect(listRecentFeedReadSamples(['a', 'b'], now)).resolves.toEqual([
      { feedId: 'a', articles: 2, read: 1 },
      { feedId: 'b', articles: 1, read: 1 },
    ]);
  });

  it('returns zero samples for subscribed feeds without mature articles', async () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    await (await getDb()).put('items', item('new', 'a', now - 2 * 24 * 60 * 60 * 1000));
    await expect(listRecentFeedReadSamples(['a', 'b'], now)).resolves.toEqual([
      { feedId: 'a', articles: 0, read: 0 },
      { feedId: 'b', articles: 0, read: 0 },
    ]);
  });
});
