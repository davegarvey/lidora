# Design

## Rotation order

The client generates the new key, records `{ oldKey, newKey }` in `meta` under `pendingSyncRotation`, and calls `POST /sync/rotate` with the old key in the header. Only a `204` (or the recovery below) leads to storing the new key. On failure the stored key is unchanged, so the old key keeps syncing and the user can retry.

A retry reuses the pending pair when its `oldKey` matches the stored key. Persisting the pair, rather than holding it in memory, covers a reload between attempts.

If the server committed the rotation but the response was lost, the retry's old key is rejected with `401`. The client then sends `GET /sync/tokens` with the pending new key. A `200` proves the server registered the new key under this rotation, because the new key is random and only this device knows it, so the client completes the rotation. Any other answer fails the rotation and leaves the old key stored. This probe is read-only and does not register anything, so it does not conflict with the rule that a `401` is never recovered by registering.

## Re-seeding the new account

Rotation does not move data on the server; that remains intentional, so a stolen key cannot reach any data from the new account. Instead, the rotating device uploads its own library. After a successful rotation the client clears the sync cursors and dirty set and calls `triggerFirstTime()`. First-time setup pulls the empty account, pushes every local feed and flag that is not on the server, and bootstraps statistics. Its local diff supersedes the dirty set, so clearing it loses nothing.

If the upload fails, the rotation still stands: the user has already signed out other devices. `lastSyncAt` stays unset, and `pullShared` now runs first-time setup when `lastSyncAt` is unset, so the next pull (focus, online, Sync now or boot) completes the upload. Boot already behaved this way. A pull-triggered setup does not call `POST /sync/register`: the rotated-to key is already registered, and skipping registration keeps a deleted or rejected key from being recreated. `triggerFirstTime()` and pulls share one in-flight guard, so a focus pull cannot start a second setup while one runs.

## Deletion

The dialog's confirm handler separates the server request from local clean-up. A server failure keeps the existing message. A local failure after a successful deletion says the server data is deleted and asks the user to stop syncing on this device.

## Server target-key check

`POST /sync/rotate` looks up the new key before the batch and returns `409` with a JSON error if it exists. The batch inserts the new key with a plain `INSERT`, so a concurrent registration of the same key fails the batch rather than silently joining an existing account.

## Relation to settings-page-redesign

The unarchived `settings-page-redesign` change also modifies "Delete sync data from Settings", "Regeneration rotates the key and preserves local state" and "Rotation revokes a lost or stolen device's key". Its deltas for those three requirements are updated to match this change, so the two can be archived in either order.
