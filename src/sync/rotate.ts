import { rotateSyncKey } from './client';
import { generateSyncKey, getPendingRotation, getStoredSyncKey, setPendingRotation } from './key';

/**
 * Rotate the stored sync key on the server and return the new key. The new
 * key is recorded as a pending rotation before the request and is not stored
 * as the sync key here: the caller stores it once this resolves. A retry
 * after a failure reuses the pending pair, so the server sees the same old
 * and new key until one attempt succeeds.
 */
export async function rotateStoredSyncKey(): Promise<string> {
  const oldKey = await getStoredSyncKey();
  if (!oldKey) throw new Error('No sync key stored');
  const pending = await getPendingRotation();
  const newKey = pending?.oldKey === oldKey ? pending.newKey : generateSyncKey();
  await setPendingRotation({ oldKey, newKey });
  await rotateSyncKey(oldKey, newKey);
  return newKey;
}
