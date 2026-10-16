# Make sync key rotation safe to retry and complete

## Why

"Sign out other devices and agents" rotates the sync key. A review of the Server data actions found that the confirmations and server authorisation are sound, but the client side of rotation can leave the user worse off than before:

- The client stores the new key before the server accepts it. If `POST /sync/rotate` fails, the device holds a key the server does not know while the old key, possibly on a lost device, still works. Retrying from the dialog then sends the unregistered new key as the old key, which the server rejects every time. The device can only recover by pairing again.
- Rotation deliberately creates an empty server account, but the client keeps `lastSyncAt` and never runs first-time setup, so it never uploads its subscriptions, flags or statistics to the new account. Devices paired afterwards, reconnected agents and server polling see an empty library. This defeats the main use of the action: recovering from a lost device.
- After a successful server deletion, a failure while turning sync off locally is reported as a failed deletion.
- The server accepts an existing key, including a rotated one, as the rotation target.

## What changes

- The client keeps a pending rotation (old and new key) and stores the new key only after the server accepts it. A retry reuses the same pair. If the server rejects the old key because an earlier attempt already rotated it, the client confirms that the pending new key is live and completes the rotation.
- After a successful rotation the client clears `lastSyncAt`, the statistics and items cursors, the server offset and the dirty set, and runs first-time setup, which uploads the local library into the new account. If that upload fails, the next pull runs first-time setup instead.
- A pull with no stored `lastSyncAt` runs first-time setup.
- Deletion reports a local failure after a successful server deletion separately, telling the user the server data is gone.
- `POST /sync/rotate` rejects a new key that already exists with `409`.

## Impact

Client sync (`src/state.tsx`, `src/sync/`), the Server data settings section, and the `/sync/rotate` route. No schema change. A pending rotation is stored in the IndexedDB `meta` store under `pendingSyncRotation` and cleared when the rotation completes or sync is turned off.
