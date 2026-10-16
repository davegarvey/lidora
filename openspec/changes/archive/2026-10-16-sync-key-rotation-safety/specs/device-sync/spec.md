## MODIFIED Requirements

### Requirement: Regeneration rotates the key and preserves local state

Regenerating the sync key (without disabling sync) SHALL preserve local feeds, items, flags and statistics, and SHALL upload them to the new account. Settings SHALL present regeneration as "Sign out other devices and agents" in the Server data section. The client SHALL generate a new key, record the old and new key as a pending rotation in the IndexedDB `meta` store, and call `POST /sync/rotate` with the old key in the `X-Sync-Key` header and the new key in the body. The server registers the new key and marks the old key's account rotated in one batch. The client SHALL store the new key only after the rotation succeeds. A retry SHALL reuse the pending pair while its old key matches the stored key. After success the client SHALL clear the pending rotation, `lastSyncAt`, the statistics and items cursors, the server offset and the dirty set, and SHALL run first-time setup with the new key. A `401` is never recovered by registering: a key the server rejects stays rejected, and the client handles it as defined by the requirement "A rejected sync key is not retried".

#### Scenario: User regenerates the key
- **WHEN** the user activates "Sign out other devices and agents" and confirms
- **THEN** the system SHALL generate a new sync key and record the pending rotation
- **AND** SHALL call `POST /sync/rotate`, which registers the new key and rotates the old one
- **AND** only after the rotation succeeds SHALL replace the local sync key and clear `lastSyncAt`, the cursors, the server offset and the dirty set
- **AND** SHALL run first-time setup, which pushes every local feed and flag missing from the new account and bootstraps statistics

#### Scenario: Rotation request fails
- **WHEN** the user regenerates the key and `POST /sync/rotate` fails
- **THEN** the old key SHALL remain stored and SHALL keep syncing
- **AND** the failure SHALL be logged with `console.error`
- **AND** the confirmation SHALL stay open and show that the other devices and agents could not be signed out
- **AND** the pending rotation SHALL remain recorded

#### Scenario: Retry after a failed rotation
- **WHEN** the user confirms again after a failed rotation
- **THEN** the client SHALL send the same old and new key as the failed attempt

#### Scenario: Rotation committed but the response was lost
- **WHEN** a retry's `POST /sync/rotate` answers `401` because an earlier attempt already rotated the old key
- **THEN** the client SHALL send `GET /sync/tokens` with the pending new key
- **AND** if it answers `200` SHALL complete the rotation as if `POST /sync/rotate` had succeeded
- **AND** otherwise SHALL fail the rotation and keep the old key stored

#### Scenario: Upload to the new account fails
- **WHEN** the rotation succeeds but first-time setup fails
- **THEN** the rotation SHALL be reported as successful
- **AND** `lastSyncAt` SHALL remain unset so that the next pull runs first-time setup

#### Scenario: 401 is not auto-registered
- **WHEN** the server returns `401` for a sync request
- **THEN** the client SHALL NOT call `POST /sync/register` and SHALL NOT retry the request
- **AND** the only client paths that register a key are turning sync on, pairing, issuing a pairing code and rotation, each an explicit user action

### Requirement: Rotation revokes a lost or stolen device's key

The system SHALL provide no key revocation other than rotation. The only remediation for a stolen device is to regenerate the key on a trusted device and pair the other devices again. Rotation SHALL take effect at once: the server SHALL reject the old key and every agent token minted under it with `401`, and `POST /sync/register` SHALL refuse to register the old key while its rotated account exists (`403`). `POST /sync/rotate` SHALL reject a new key that already has an account with `409`. Rotation does not move data on the server; the old account's rows stay on the server, unreadable through the API, until the daily cron deletes them 30 days after rotation. The rotating device repopulates the new account from its local library.

#### Scenario: User regenerates key after device loss
- **WHEN** the user opens Settings → Server data on a trusted device
- **AND** activates "Sign out other devices and agents" and confirms
- **THEN** a new sync key SHALL be generated, registered on the server and stored locally
- **AND** no data SHALL be migrated from the old account to the new one on the server
- **AND** the trusted device SHALL upload its local subscriptions, flags and statistics to the new account
- **AND** a device paired afterwards with the new key SHALL receive them

#### Scenario: Rotation target already exists
- **WHEN** a client calls `POST /sync/rotate` with a new key that already has an account, rotated or not
- **THEN** the server SHALL respond `409`
- **AND** SHALL NOT change either account

#### Scenario: Stolen device's key is rejected after rotation
- **WHEN** a stolen device presents the previous sync key after rotation
- **THEN** the server SHALL respond `401` to push, pull and every other authenticated route
- **AND** agent tokens minted under the old key SHALL be rejected with `401`
- **AND** the action's description in Settings SHALL state that it is the way to remove access from a lost device or an agent, and the confirmation SHALL state that other devices must be added again and agents reconnected

#### Scenario: Old account is erased after the grace period
- **WHEN** 30 days have passed since the rotation
- **THEN** the daily cron SHALL delete the old account and its rows, as defined by the requirement "Retention of rotated and inactive accounts"

### Requirement: Delete sync data from Settings

When this device has a sync key, the Server data section SHALL offer a "Delete data from the server" action behind a danger confirmation dialog. The dialog SHALL state that the synced subscriptions, flags, statistics and agent access are deleted from the server, that other paired devices will stop syncing, and that reading data on this device is kept. On confirmation the client SHALL call `DELETE /sync/account` and, when it succeeds, call `disableSync()` and show the Devices section. A `401` response SHALL count as success, because the server no longer holds the account. Any other failure SHALL leave sync enabled and keep the dialog open with "Couldn't delete the data from the server. Try again." If the deletion succeeds but turning sync off locally fails, the dialog SHALL stay open and state that the data was deleted from the server and that the user should stop syncing on this device. Local feeds, items, flags and statistics SHALL NOT be changed.

#### Scenario: Deletion confirmed
- **WHEN** the user confirms Delete data from the server
- **THEN** the client SHALL send `DELETE /sync/account` with the stored key
- **AND** the dialog SHALL show a busy state until the request completes
- **AND** on success SHALL disable sync locally and show the Devices section
- **AND** SHALL NOT remove any local feed, item or flag

#### Scenario: Deletion cancelled
- **WHEN** the user cancels the confirmation
- **THEN** no request SHALL be sent
- **AND** sync SHALL remain enabled

#### Scenario: Server error
- **WHEN** the server answers `500` or `429`
- **THEN** sync SHALL remain enabled
- **AND** the dialog SHALL remain open and show the error

#### Scenario: Local clean-up fails after deletion
- **WHEN** the server deletes the account but turning sync off locally fails
- **THEN** the dialog SHALL remain open
- **AND** SHALL state that the data was deleted from the server and that the user should stop syncing on this device

#### Scenario: Re-enabling after deletion
- **WHEN** the user turns sync on after deleting sync data
- **THEN** a new sync key SHALL be generated and registered

### Requirement: Client pulls on boot, focus, and online

The system SHALL pull server state on app boot, when the browser tab becomes visible, and when the browser fires an `online` event, so that changes from other devices are reflected. When sync is enabled but `lastSyncAt` is unset, every such pull after boot SHALL run first-time setup instead, without registering the key.

#### Scenario: App boot pulls since last sync
- **WHEN** the user opens the app
- **AND** sync is enabled
- **AND** the boot order is: load settings → pull + apply → reload feeds → reload items
- **THEN** the client SHALL request a pull with `since=lastSyncAt`
- **AND** SHALL apply the returned state to the local IndexedDB
- **AND** SHALL update `lastSyncAt` to `max(currentLastSyncAt, serverTime)`

#### Scenario: Tab focus triggers a pull
- **WHEN** the browser tab becomes visible
- **AND** the previous successful pull was more than 30 seconds ago
- **THEN** a pull SHALL be triggered

#### Scenario: Browser comes online triggers a pull
- **WHEN** the browser fires an `online` event
- **THEN** a pull SHALL be triggered

#### Scenario: Pull without lastSyncAt
- **WHEN** a pull is triggered while sync is enabled and `lastSyncAt` is unset
- **THEN** the client SHALL run first-time setup, pushing local state missing from the server before applying server state
- **AND** SHALL NOT call `POST /sync/register`, so a key the server rejects stays rejected
