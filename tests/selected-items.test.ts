import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/open';
import { listSelectedItems } from '../src/db/items';
import { listForYouCandidates } from '../src/db/items';
import type { Item } from '../src/db/types';

function item(id: number, feedId = 'feed', read = true, starred = false): Item {
  return { id: `${feedId}::${id}`, feedId, guid: String(id), title: 'Article', excerpt: '', publishedAt: id, updatedAt: id, createdAt: id, read, starred };
}

beforeEach(async () => {
  const db = await getDb();
  await db.clear('items');
  await db.clear('readMarkers');
});

describe('selected article queries', () => {
  it('finds an older unread article behind 500 newer read articles', async () => {
    const db = await getDb();
    const tx = db.transaction('items', 'readwrite');
    for (let i = 1; i <= 501; i++) await tx.store.put(item(i, 'feed', i !== 1));
    await tx.done;
    const result = await listSelectedItems({ feedIds: new Set(['feed']), unreadOnly: true, starredOnly: false });
    expect(result.items.map((item) => item.guid)).toEqual(['1']);
    expect(result.hasStoredItems).toBe(true);
  });

  it('scopes before limiting and orders matching articles newest first', async () => {
    const db = await getDb();
    for (const value of [item(1, 'a', false), item(3, 'a', false), item(4, 'b', false), item(2, 'a', false)]) await db.put('items', value);
    const result = await listSelectedItems({ feedIds: new Set(['a']), unreadOnly: true, starredOnly: false, limit: 2 });
    expect(result.items.map((item) => item.guid)).toEqual(['3', '2']);
  });

  it('distinguishes caught-up scope from a scope with no articles', async () => {
    await (await getDb()).put('items', item(1));
    expect(await listSelectedItems({ feedIds: new Set(['feed']), unreadOnly: true, starredOnly: false })).toEqual({ items: [], hasStoredItems: true });
    expect(await listSelectedItems({ feedIds: new Set(['other']), unreadOnly: true, starredOnly: false })).toEqual({ items: [], hasStoredItems: false });
  });

  it('includes read starred articles when unread mode is bypassed', async () => {
    const db = await getDb();
    await db.put('items', item(1, 'feed', true, true));
    await db.put('items', item(2, 'feed', false, false));
    const result = await listSelectedItems({ feedIds: new Set(['feed']), unreadOnly: false, starredOnly: true });
    expect(result.items.map((item) => item.guid)).toEqual(['1']);
  });

  it('includes candidates from a quiet feed before the shared limit', async () => {
    const db = await getDb();
    for (let i = 1; i <= 501; i++) await db.put('items', item(i, 'busy', false));
    await db.put('items', item(1, 'quiet', false));
    const result = await listForYouCandidates({ feedIds: new Set(['busy', 'quiet']), unreadOnly: true, starredOnly: false, limit: 500 });
    expect(result.items).toHaveLength(501);
    expect(result.items.some((entry) => entry.feedId === 'quiet')).toBe(true);
    expect(result.hasStoredItems).toBe(true);
  });

  it('filters read and starred state before collecting each feed candidate batch', async () => {
    const db = await getDb();
    for (let i = 1; i <= 4; i++) await db.put('items', item(i, 'a', true, i === 1));
    await db.put('items', item(5, 'a', false, false));
    const result = await listForYouCandidates({ feedIds: new Set(['a']), unreadOnly: true, starredOnly: false, limit: 2 });
    expect(result.items.map((entry) => entry.guid)).toEqual(['5']);
  });
});
