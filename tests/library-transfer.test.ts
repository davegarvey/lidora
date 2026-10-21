import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { databaseNameForHost } from '../src/db/types';
import { getDb } from '../src/db/open';
import { LIBRARY_STORES, createLibraryBackup, libraryDigest, mergeLibraries, readLibrarySnapshot, writeMergedLibrary, type LibrarySnapshot } from '../src/db/library-transfer';

function library(feedId: string, url: string, title: string): LibrarySnapshot {
  const itemId = `${feedId}::guid-1`;
  return {
    schemaVersion: 11,
    feeds: [{ id: feedId, url, title, titleAt: 10, tags: [], lastFetched: 100, learnedIntervalMs: 3_600_000 }],
    items: [{ id: itemId, feedId, guid: 'guid-1', title: `${title} story`, publishedAt: 1, updatedAt: 1, excerpt: 'summary', read: false, starred: false, createdAt: 1, lastSeenAt: 1 }],
    itemBodies: [{ id: itemId, feedId, html: '<p>full feed body</p>', htmlBaseUrl: new URL('posts/', url).toString(), extractedHtml: '<p>saved text</p>' }],
    meta: [{ key: 'settings', value: { theme: 'dark', syncKey: 'account-key', lastItemsCursor: 18 } }, { key: 'sync_dirty', value: [{ kind: 'feed-upsert', feedId }] }],
    itemFlags: [{ id: itemId, feedId, read: 0, starred: 1 }],
    feedStats: [{ feedId, totalSeen: 4, readOnce: 2, serverReadOnce: 1, title, url }],
    readMarkers: [{ id: itemId, feedId, acknowledged: 0 }],
  };
}

describe('full library transfer', () => {
  beforeEach(async () => {
    const db = await getDb();
    const tx = db.transaction([...LIBRARY_STORES], 'readwrite');
    for (const store of LIBRARY_STORES) tx.objectStore(store).clear();
    await tx.done;
  });

  it('uses the new browser database only on the Lidora hosted origin', () => {
    expect(databaseNameForHost('lidora.app')).toBe('lidora');
    expect(databaseNameForHost('lidora.localhost')).toBe('lidora');
    expect(databaseNameForHost('sift.davegarvey.workers.dev')).toBe('sift');
    expect(databaseNameForHost('reader.example.com')).toBe('sift');
  });

  it('preserves every store, account settings and pending state while merging destination data', () => {
    const source = library('shared', 'https://source.example/feed.xml', 'Source');
    const destination = library('shared', 'https://destination.example/feed.xml', 'Destination');
    destination.feeds.push({ ...destination.feeds[0], id: 'other', url: 'https://shared.example/feed.xml', title: 'Existing' });
    destination.items.push({ ...destination.items[0], id: 'other::guid-1', feedId: 'other', title: 'Existing article', read: true });
    destination.itemBodies.push({ ...destination.itemBodies[0], id: 'other::guid-1', feedId: 'other', html: '<p>Existing body</p>' });
    destination.itemFlags.push({ ...destination.itemFlags[0], id: 'other::guid-1', feedId: 'other', read: 1, starred: 0 });
    destination.feedStats.push({ feedId: 'other', totalSeen: 2, readOnce: 1, serverReadOnce: 0, title: 'Existing', url: 'https://shared.example/feed.xml' });
    destination.readMarkers.push({ id: 'other::guid-1', feedId: 'other', acknowledged: 1 });
    destination.meta.push({ key: 'destination-only', value: 'kept' });

    const merged = mergeLibraries(source, destination);
    expect(merged.feeds).toHaveLength(3);
    const moved = merged.feeds.find((feed) => feed.url === 'https://source.example/feed.xml');
    expect(moved?.id).not.toBe('shared');
    expect(merged.items.map((item) => item.feedId)).toContain('shared');
    expect(merged.items.map((item) => item.feedId)).toContain(moved?.id);
    expect(merged.itemBodies).toHaveLength(3);
    expect(merged.itemBodies.find((body) => body.feedId === moved?.id)?.htmlBaseUrl).toBe('https://source.example/posts/');
    expect(merged.itemFlags).toHaveLength(3);
    expect(merged.feedStats).toHaveLength(3);
    expect(merged.readMarkers).toHaveLength(3);
    expect(merged.meta.find((row) => row.key === 'settings')?.value).toMatchObject({ theme: 'dark', syncKey: 'account-key', lastItemsCursor: 18 });
    expect(merged.meta.find((row) => row.key === 'destination-only')?.value).toBe('kept');
    expect(merged.meta.find((row) => row.key === 'sync_dirty')?.value).toHaveLength(2);
  });

  it('leaves destination data unchanged when validation fails and accepts a full backup', async () => {
    const existing = library('existing', 'https://existing.example/feed.xml', 'Existing');
    await writeMergedLibrary(existing);
    const before = await readLibrarySnapshot();
    const invalid = library('bad', 'https://bad.example/feed.xml', 'Bad');
    invalid.itemBodies[0].feedId = 'missing';
    await expect(writeMergedLibrary(invalid)).rejects.toThrow('without its subscription');
    expect(await readLibrarySnapshot()).toEqual(before);

    const backup = JSON.parse(await createLibraryBackup(library('restored', 'https://restored.example/feed.xml', 'Restored')).text());
    await writeMergedLibrary((await import('../src/db/library-transfer')).parseLibraryBackup(backup));
    expect((await readLibrarySnapshot()).feeds.map((feed) => feed.id)).toEqual(expect.arrayContaining(['existing', 'restored']));
  });

  it('produces a stable integrity digest for the complete seven-store snapshot', async () => {
    const value = library('one', 'https://one.example/feed.xml', 'One');
    expect(await libraryDigest(value)).toMatch(/^[a-f0-9]{64}$/);
    expect(await libraryDigest(value)).toBe(await libraryDigest(value));
  });

  it('keeps a different destination sync credential while the source account stays active', () => {
    const source = library('source', 'https://source.example/feed.xml', 'Source');
    const destination = library('target', 'https://target.example/feed.xml', 'Target');
    destination.meta.find((row) => row.key === 'settings')!.value = { syncKey: 'destination-key', lastSyncAt: 9, lastItemsCursor: 12, theme: 'light' };
    const merged = mergeLibraries(source, destination);
    expect(merged.meta.find((row) => row.key === 'settings')?.value).toMatchObject({ syncKey: 'account-key', theme: 'dark' });
    expect(merged.meta.find((row) => row.key === 'lidora-migration-retained-sync-accounts')?.value).toEqual([
      { syncKey: 'destination-key', lastSyncAt: 9, lastItemsCursor: 12 },
    ]);
  });
});
