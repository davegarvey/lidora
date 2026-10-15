import { getDb } from './open';
import { DB_VERSION } from './types';

export const LIBRARY_STORES = ['feeds', 'items', 'itemBodies', 'meta', 'itemFlags', 'feedStats', 'readMarkers'] as const;
export type LibraryStore = (typeof LIBRARY_STORES)[number];
export type LibraryRecord = Record<string, unknown>;
export type LibrarySnapshot = { schemaVersion: number } & Record<LibraryStore, LibraryRecord[]>;

const itemStores = ['items', 'itemBodies', 'itemFlags', 'readMarkers'] as const;

function isRecord(value: unknown): value is LibraryRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyOf(store: LibraryStore, row: LibraryRecord): string | undefined {
  const key = store === 'meta' ? row.key : store === 'feedStats' ? row.feedId : row.id;
  return typeof key === 'string' ? key : undefined;
}

function records(snapshot: unknown): LibrarySnapshot {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== DB_VERSION) {
    throw new Error('This library backup uses an unsupported database version. Update Lidora and try again.');
  }
  const result = { schemaVersion: DB_VERSION } as LibrarySnapshot;
  for (const store of LIBRARY_STORES) {
    const value = snapshot[store];
    if (!Array.isArray(value) || !value.every(isRecord)) {
      throw new Error('The library data is incomplete or invalid. The destination was not changed.');
    }
    result[store] = value;
    const keys = new Set<string>();
    for (const row of value) {
      const key = keyOf(store, row);
      if (!key || keys.has(key)) throw new Error('The library contains an invalid or duplicate record. The destination was not changed.');
      keys.add(key);
    }
  }
  validateRelations(result);
  return result;
}

function validateRelations(snapshot: LibrarySnapshot): void {
  const feeds = new Set(snapshot.feeds.map((feed) => feed.id as string));
  const itemFeeds = new Map(snapshot.items.map((item) => [item.id as string, item.feedId as string]));
  for (const item of snapshot.items) {
    if (typeof item.feedId !== 'string' || !feeds.has(item.feedId) || typeof item.guid !== 'string' || item.id !== `${item.feedId}::${item.guid}`) {
      throw new Error('The library contains an article without its subscription. The destination was not changed.');
    }
  }
  for (const store of itemStores) {
    for (const row of snapshot[store]) {
      if (typeof row.feedId !== 'string' || !feeds.has(row.feedId)) {
        throw new Error('The library contains a record without its subscription. The destination was not changed.');
      }
      if (store !== 'items' && typeof row.id !== 'string') {
        throw new Error('The library contains a state record without its article. The destination was not changed.');
      }
      if (store !== 'items' && !itemFeeds.has(row.id as string)) {
        throw new Error('The library contains an article body without its article. The destination was not changed.');
      }
      if (store !== 'items' && itemFeeds.get(row.id as string) !== row.feedId) {
        throw new Error('The library contains article state attached to a different subscription. The destination was not changed.');
      }
    }
  }
}

export async function readLibrarySnapshot(): Promise<LibrarySnapshot> {
  const db = await getDb();
  const tx = db.transaction([...LIBRARY_STORES], 'readonly');
  const values = await Promise.all(LIBRARY_STORES.map((store) => tx.objectStore(store).getAll()));
  await tx.done;
  const snapshot = Object.fromEntries([['schemaVersion', DB_VERSION], ...LIBRARY_STORES.map((store, index) => [store, values[index]])]);
  const itemIds = new Set((values[LIBRARY_STORES.indexOf('items')] as unknown[])
    .filter(isRecord)
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string'));
  for (const store of ['itemBodies', 'itemFlags', 'readMarkers'] as const) {
    const rows = snapshot[store] as unknown[];
    snapshot[store] = rows.filter((row) => !isRecord(row) || typeof row.id !== 'string' || itemIds.has(row.id));
  }
  return records(snapshot);
}

function mergeFeed(source: LibraryRecord, destination: LibraryRecord): LibraryRecord {
  const merged = { ...source, ...destination };
  for (const [field, atField] of [['title', 'titleAt'], ['url', 'urlAt'], ['tags', 'tagsAt'], ['htmlUrl', 'htmlUrlAt']] as const) {
    const sourceAt = typeof source[atField] === 'number' ? source[atField] as number : 0;
    const destinationAt = typeof destination[atField] === 'number' ? destination[atField] as number : 0;
    if (sourceAt > destinationAt) merged[field] = source[field];
    merged[atField] = Math.max(sourceAt, destinationAt);
  }
  for (const field of ['lastFetched', 'sourceFetchedAt', 'nextCheckAt', 'lastItemPublishedAt', 'modifiedAt'] as const) {
    const a = typeof source[field] === 'number' ? source[field] as number : null;
    const b = typeof destination[field] === 'number' ? destination[field] as number : null;
    merged[field] = a === null ? b : b === null ? a : Math.max(a, b);
  }
  if (!destination.refreshError && source.refreshError) merged.refreshError = source.refreshError;
  if (!destination.etag && source.etag) merged.etag = source.etag;
  if (!destination.lastModified && source.lastModified) merged.lastModified = source.lastModified;
  return merged;
}

function mergeItem(source: LibraryRecord, destination: LibraryRecord, id: string, feedId: string): LibraryRecord {
  const opened = [source.firstOpenedAt, destination.firstOpenedAt].filter((value): value is number => typeof value === 'number');
  return {
    ...source,
    ...destination,
    id,
    feedId,
    read: source.read === true || destination.read === true,
    starred: source.starred === true || destination.starred === true,
    firstOpenedAt: opened.length ? Math.min(...opened) : null,
    createdAt: Math.min(Number(source.createdAt) || 0, Number(destination.createdAt) || 0),
    updatedAt: Math.max(Number(source.updatedAt) || 0, Number(destination.updatedAt) || 0),
    lastSeenAt: Math.max(Number(source.lastSeenAt) || 0, Number(destination.lastSeenAt) || 0),
  };
}

function mergeRows(store: LibraryStore, source: LibraryRecord, destination: LibraryRecord, id: string, feedId?: string): LibraryRecord {
  if (store === 'items') return mergeItem(source, destination, id, feedId ?? String(destination.feedId));
  if (store === 'itemBodies') return { ...source, ...destination, id, feedId: feedId ?? destination.feedId };
  if (store === 'itemFlags') return {
    ...source, ...destination, id, feedId: feedId ?? destination.feedId,
    read: source.read === 1 || destination.read === 1 ? 1 : 0,
    starred: source.starred === 1 || destination.starred === 1 ? 1 : 0,
  };
  if (store === 'readMarkers') return {
    ...source, ...destination, id, feedId: feedId ?? destination.feedId,
    acknowledged: source.acknowledged === 0 || destination.acknowledged === 0 ? 0 : 1,
  };
  if (store === 'feedStats') return {
    ...source, ...destination, feedId: id,
    totalSeen: Math.max(Number(source.totalSeen) || 0, Number(destination.totalSeen) || 0),
    readOnce: Math.max(Number(source.readOnce) || 0, Number(destination.readOnce) || 0),
    serverReadOnce: Math.max(Number(source.serverReadOnce) || 0, Number(destination.serverReadOnce) || 0),
  };
  return { ...source, ...destination };
}

function mergeMeta(source: LibraryRecord[], destination: LibraryRecord[], feedIds: Map<string, string>): LibraryRecord[] {
  const merged = new Map(destination.map((row) => [String(row.key), row]));
  const retainSyncAccount = (settings: LibraryRecord) => {
    const value = settings.value;
    if (!isRecord(value) || typeof value.syncKey !== 'string' || !value.syncKey) return;
    const key = 'lidora-migration-retained-sync-accounts';
    const existing = merged.get(key);
    const accounts = Array.isArray(existing?.value) ? existing.value.filter(isRecord) : [];
    const account = Object.fromEntries(['syncKey', 'lastSyncAt', 'lastStatsSyncAt', 'lastItemsCursor', 'serverOffset']
      .filter((field) => field in value)
      .map((field) => [field, value[field]]));
    if (!accounts.some((entry) => entry.syncKey === value.syncKey)) {
      merged.set(key, { key, value: [...accounts, account] });
    }
  };
  for (const sourceRow of source) {
    const key = String(sourceRow.key);
    const destinationRow = merged.get(key);
    if (!destinationRow) {
      merged.set(key, sourceRow);
    } else if (key === 'settings' && isRecord(sourceRow.value) && isRecord(destinationRow.value)) {
      if (typeof sourceRow.value.syncKey === 'string' && typeof destinationRow.value.syncKey === 'string' && sourceRow.value.syncKey !== destinationRow.value.syncKey) {
        retainSyncAccount(destinationRow);
      }
      merged.set(key, { key, value: { ...destinationRow.value, ...sourceRow.value } });
    } else if (key === 'lidora-migration-retained-sync-accounts' && Array.isArray(sourceRow.value) && Array.isArray(destinationRow.value)) {
      const accounts = new Map<string, LibraryRecord>();
      for (const entry of [...destinationRow.value, ...sourceRow.value]) {
        if (isRecord(entry) && typeof entry.syncKey === 'string') accounts.set(entry.syncKey, entry);
      }
      merged.set(key, { key, value: [...accounts.values()] });
    } else if (key === 'sync_dirty' && Array.isArray(sourceRow.value) && Array.isArray(destinationRow.value)) {
      const unique = new Map<string, unknown>();
      for (const entry of destinationRow.value) unique.set(JSON.stringify(entry), entry);
      for (const entry of sourceRow.value) {
        if (isRecord(entry) && typeof entry.feedId === 'string') {
          const previousId = entry.feedId;
          const feedId = feedIds.get(previousId) ?? previousId;
          const prefix = `${previousId}::`;
          const itemId = typeof entry.itemId === 'string' && entry.itemId.startsWith(prefix)
            ? `${feedId}::${entry.itemId.slice(prefix.length)}`
            : entry.itemId;
          const remapped = { ...entry, feedId, ...(typeof itemId === 'string' ? { itemId } : {}) };
          unique.set(JSON.stringify(remapped), remapped);
        } else {
          unique.set(JSON.stringify(entry), entry);
        }
      }
      merged.set(key, { key, value: [...unique.values()] });
    } else {
      merged.set(key, sourceRow);
    }
  }
  return [...merged.values()];
}

export function mergeLibraries(sourceInput: unknown, destinationInput: unknown): LibrarySnapshot {
  const source = records(sourceInput);
  const destination = records(destinationInput);
  const result = { schemaVersion: DB_VERSION } as LibrarySnapshot;
  const sourceFeedIds = new Map<string, string>();
  const destinationByUrl = new Map(destination.feeds.map((feed) => [String(feed.url), feed]));
  const destinationFeedIds = new Set(destination.feeds.map((feed) => String(feed.id)));

  const feedsById = new Map(destination.feeds.map((feed) => [String(feed.id), feed]));
  for (const sourceFeed of source.feeds) {
    const sourceId = String(sourceFeed.id);
    const sameUrl = destinationByUrl.get(String(sourceFeed.url));
    const targetId = sameUrl
      ? String(sameUrl.id)
      : destinationFeedIds.has(sourceId)
        ? `lidora-${crypto.randomUUID()}`
        : sourceId;
    sourceFeedIds.set(sourceId, targetId);
    const remapped = { ...sourceFeed, id: targetId };
    const existing = feedsById.get(targetId);
    feedsById.set(targetId, existing ? mergeFeed(remapped, existing) : remapped);
  }
  result.feeds = [...feedsById.values()];

  for (const store of ['items', 'itemBodies', 'itemFlags', 'readMarkers'] as const) {
    const merged = new Map(destination[store].map((row) => [String(row.id), row]));
    for (const sourceRow of source[store]) {
      const originalFeedId = String(sourceRow.feedId);
      const feedId = sourceFeedIds.get(originalFeedId) ?? originalFeedId;
      const originalId = String(sourceRow.id);
      const id = feedId === originalFeedId ? originalId : `${feedId}::${originalId.slice(originalFeedId.length + 2)}`;
      const row = { ...sourceRow, id, feedId };
      const existing = merged.get(id);
      merged.set(id, existing ? mergeRows(store, row, existing, id, feedId) : row);
    }
    result[store] = [...merged.values()];
  }

  const mergedStats = new Map(destination.feedStats.map((row) => [String(row.feedId), row]));
  for (const sourceRow of source.feedStats) {
    const feedId = sourceFeedIds.get(String(sourceRow.feedId)) ?? String(sourceRow.feedId);
    const existing = mergedStats.get(feedId);
    mergedStats.set(feedId, existing ? mergeRows('feedStats', { ...sourceRow, feedId }, existing, feedId) : { ...sourceRow, feedId });
  }
  result.feedStats = [...mergedStats.values()];
  result.meta = mergeMeta(source.meta, destination.meta, sourceFeedIds);
  return records(result);
}

export async function writeMergedLibrary(source: unknown): Promise<LibrarySnapshot> {
  const db = await getDb();
  const tx = db.transaction([...LIBRARY_STORES], 'readwrite');
  const currentValues = await Promise.all(LIBRARY_STORES.map((store) => tx.objectStore(store).getAll()));
  const destination = records(Object.fromEntries([['schemaVersion', DB_VERSION], ...LIBRARY_STORES.map((store, index) => [store, currentValues[index]])]));
  const merged = mergeLibraries(source, destination);
  for (const store of LIBRARY_STORES) {
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    for (const row of merged[store]) objectStore.put(row as never);
  }
  await tx.done;
  const saved = await readLibrarySnapshot();
  if (await libraryDigest(saved) !== await libraryDigest(merged)) {
    throw new Error('The saved library did not pass its readback check. The original library is still safe.');
  }
  return saved;
}

export function parseLibraryBackup(value: unknown): LibrarySnapshot {
  if (!isRecord(value) || value.format !== 'lidora-library' || !('library' in value)) {
    throw new Error('This file is not a Lidora library backup. The destination was not changed.');
  }
  return records(value.library);
}

export async function restoreLibraryBackup(value: unknown): Promise<void> {
  await writeMergedLibrary(parseLibraryBackup(value));
}

export function createLibraryBackup(snapshot: LibrarySnapshot): Blob {
  return new Blob([JSON.stringify({ format: 'lidora-library', exportedAt: new Date().toISOString(), library: records(snapshot) })], { type: 'application/json' });
}

export async function libraryDigest(snapshot: LibrarySnapshot): Promise<string> {
  const valid = records(snapshot);
  const canonical = {
    schemaVersion: DB_VERSION,
    ...Object.fromEntries(LIBRARY_STORES.map((store) => [store, [...valid[store]].sort((a, b) => String(keyOf(store, a)).localeCompare(String(keyOf(store, b))))])),
  } as LibrarySnapshot;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}
