## ADDED Requirements

### Requirement: Add a device card

The Devices section SHALL offer an Add a device card that is collapsed until the user activates it. Activating it SHALL turn sync on first if it is off, then issue a pairing code and expand the card to show the code grouped as `abcd-efgh` with a copy button, a QR code of the pair URL (`<origin>/?pair=<code>`), the instruction to enter the code or scan it on the other device, and an expiry countdown beside the code.

#### Scenario: Add a device with sync off
- **WHEN** a user without a sync key activates Add a device
- **THEN** the system SHALL turn sync on
- **AND** SHALL then expand the card with a pairing code, its QR code and its expiry countdown

#### Scenario: Add a device with sync on
- **WHEN** a user with a sync key activates Add a device
- **THEN** the card SHALL expand with a newly issued pairing code without changing the sync key

#### Scenario: No code without the card
- **WHEN** the user opens the Devices section without activating Add a device
- **THEN** no pairing code SHALL be issued

#### Scenario: Code refreshes while open
- **WHEN** the code expires while the card is expanded
- **THEN** a new code SHALL be issued and shown automatically

#### Scenario: Card collapsed
- **WHEN** the user collapses the card or leaves the section
- **THEN** the code's refresh and countdown timers SHALL be cleared

#### Scenario: Turning sync on fails
- **WHEN** turning sync on fails
- **THEN** the card SHALL show the failure with a Retry action
- **AND** sync SHALL remain off

#### Scenario: Code refresh fails
- **WHEN** a code refresh fails
- **THEN** the card SHALL show an error and a Retry action
- **AND** SHALL keep showing the previous code until it is replaced

### Requirement: Join from another device card

The Devices section SHALL offer a Join from another device card with a "Pairing code" input that accepts an 8-character code, with or without the dash and in any letter case, or a case-sensitive 22-character sync key, explained by a "Use a sync key instead" disclosure. Pair and a Scan icon button SHALL sit beside the input.

#### Scenario: Join while already syncing
- **WHEN** sync is on and the user activates "Join a different sync instead"
- **THEN** the join card SHALL expand with a warning that joining leaves the current sync

#### Scenario: Join with a code
- **WHEN** the user submits an 8-character code in the join card
- **THEN** the system SHALL redeem it via the server, store the returned key and trigger a first-time sync
- **AND** on success the section SHALL change to its sync-on state with the status "This device is now syncing"

#### Scenario: Join with a sync key
- **WHEN** the user submits a 22-character base64url key
- **THEN** the system SHALL validate it locally without a server call, store it and trigger a first-time sync
- **AND** on success the section SHALL change to its sync-on state with the status "This device is now syncing"

#### Scenario: Invalid value
- **WHEN** the user submits a value that is neither a code nor a key
- **THEN** the card SHALL show an inline error without calling the server
- **AND** SHALL keep the entered value

#### Scenario: Key already in use
- **WHEN** the user submits the key already stored on this device
- **THEN** the card SHALL show "Already paired with this key" without triggering a sync

#### Scenario: Join fails
- **WHEN** redeeming a code or the first-time sync fails
- **THEN** the card SHALL show the error under the input
- **AND** SHALL keep the entered value so the user can correct it and retry
- **AND** the device's sync state SHALL be restored to what it was before the attempt: the previous key when it had one, otherwise sync off

### Requirement: Pair link results

When the app starts with a `?pair=<code>` query, the system SHALL redeem the code, pair, and remove the query from the URL. The result SHALL be shown in the Devices section, not in a dialog.

#### Scenario: Pair link succeeds
- **WHEN** the code in a pair link is redeemed successfully
- **THEN** Settings SHALL show the Devices section with the status "This device is now syncing"

#### Scenario: Pair link fails
- **WHEN** the code in a pair link cannot be redeemed
- **THEN** Settings SHALL show the Devices section with the join card expanded, the code filled in and the error shown

### Requirement: Devices section

Settings SHALL include a Devices section, rendered only when the server reports sync via `GET /sync/capabilities`. It SHALL cover the user's own devices only: it SHALL NOT include agent access, key rotation, disabling sync or deleting server data, and SHALL NOT present sync as a switch.

#### Scenario: Devices section is hidden when the server has no sync storage
- **WHEN** `GET /sync/capabilities` returns 404 or a body lacking `sync: true`
- **THEN** the Devices section SHALL NOT be rendered in Settings
- **AND** the capability check SHALL be performed on each page load (not cached across reloads)

#### Scenario: Sync-off state
- **WHEN** sync is disabled
- **THEN** the section SHALL display one sentence explaining that sync keeps subscriptions and reading progress in step across devices without an account
- **AND** SHALL display the Add a device card and the expanded Join from another device card side by side on wide screens and stacked on narrow screens

#### Scenario: Collecting posts without another device
- **WHEN** sync is disabled and `/sync/capabilities` reports `items: true`
- **THEN** the section SHALL display a secondary "Collect new posts while Lidora is closed" action that turns sync on for this device
- **AND** SHALL state that this stores the subscriptions on the server

#### Scenario: Sync-on state
- **WHEN** sync is enabled
- **THEN** the section SHALL display a status card with the sync status and a "Sync now" action, the collapsed Add a device card, and a secondary "Join a different sync instead" link that expands the join card

#### Scenario: Status text
- **WHEN** the status card is shown
- **THEN** it SHALL show "Sync failed" with its relative time and the full error text when the last sync failed, the pending change count when changes are waiting, "Never synced" when no sync has ever succeeded, and otherwise the relative time of the last successful sync
- **AND** the error text SHALL be visible on the page, not only in a tooltip

#### Scenario: Rejected key
- **WHEN** the server has rejected the sync key
- **THEN** the status card SHALL show the rejection message and a link to the Server data section

#### Scenario: Status updates while Settings is open
- **WHEN** the Devices section is shown
- **THEN** the status's relative time SHALL be recomputed every 30 seconds

### Requirement: Server data section

When this device has a sync key, Settings SHALL show a Server data section stating that the server holds the subscriptions, read and starred state, statistics and agent access. It SHALL show the key ID: a display-only, 4-character fingerprint derived one-way from the sync key and never used by any pairing flow, noting that it matches on every device in the same sync.

#### Scenario: Section without a key
- **WHEN** this device has no sync key
- **THEN** the Server data section SHALL NOT be shown

#### Scenario: Key ID
- **WHEN** the Server data section is shown
- **THEN** it SHALL show the 4-character key ID without a copy action

### Requirement: Account-wide sync actions

The Server data section SHALL offer three actions, each with a one-sentence description: "Stop syncing on this device" (disables sync here, confirmed inline), "Sign out other devices and agents" (regenerates the key) and "Delete data from the server" (deletes the account, in danger styling), the last two confirmed in a dialog. After stopping or deleting succeeds, Settings SHALL show the Devices section.

#### Scenario: Stop syncing
- **WHEN** the user activates Stop syncing on this device
- **THEN** an inline confirmation SHALL expand under the action and SHALL state that this device keeps its data and stops syncing, that the data stays on the server, and that other devices and agents are unaffected
- **AND** SHALL point to Delete data from the server for removing the server copy
- **AND** only on explicit confirmation SHALL the system clear the local sync key and the dirty set

#### Scenario: Stop syncing with agents connected
- **WHEN** agents are connected and the user activates Stop syncing on this device
- **THEN** the confirmation SHALL add that agents will only see changes made on other devices

#### Scenario: After stopping
- **WHEN** Stop syncing on this device succeeds
- **THEN** Settings SHALL show the Devices section in its sync-off state

## MODIFIED Requirements

### Requirement: Sync key generation and storage

When the user takes an action that turns device sync on, the system SHALL generate a 128-bit cryptographically random sync key, encode it as URL-safe base64 (22 characters), and persist it in the browser's IndexedDB. The actions that turn sync on are Add a device, Collect new posts while Lidora is closed, Connect an agent and approving an agent with an approval code. The sync key SHALL be the user's identity for sync purposes; no account, email, or password is required.

#### Scenario: User enables sync for the first time
- **WHEN** the user takes an action that turns sync on and no sync key is currently stored
- **THEN** the system SHALL generate 16 random bytes via `crypto.getRandomValues`
- **AND** SHALL encode the result as base64url
- **AND** SHALL store the encoded string in the IndexedDB meta store under the sync settings key
- **AND** SHALL continue the action that turned sync on

#### Scenario: Sync key persists across app restarts
- **WHEN** the user closes and reopens the app
- **THEN** the previously generated sync key SHALL be available from IndexedDB
- **AND** no new key SHALL be generated

#### Scenario: User regenerates the sync key
- **WHEN** the user activates "Sign out other devices and agents" and confirms it
- **THEN** a new 128-bit sync key SHALL be generated
- **AND** the previous key SHALL be replaced in IndexedDB
- **AND** the previous key's data on the server SHALL be orphaned (no migration is performed)

### Requirement: Pairing via server-generated OTP code

When a source device issues a pairing code, the server SHALL generate a unique 8-character code (lowercase alphanumeric, no ambiguous characters), store it with a 5-minute TTL, return it to the source, and allow a target device to redeem the code to receive the sync key.

#### Scenario: Source issues a code
- **WHEN** the user activates the Add a device card on a source device
- **THEN** the client SHALL call `POST /sync/otp` (no body)
- **AND** SHALL display the returned code in the card with a 5-minute countdown
- **AND** the server SHALL generate the code from the alphabet `[a-hj-km-np-z2-9]` (31 unambiguous characters; excludes `0`, `1`, `i`, `l`, `o`)
- **AND** SHALL store `(code, sync_key, expires_at)` in the `pairing_codes` table

#### Scenario: Code is unique
- **WHEN** the server generates a pairing code
- **THEN** the server SHALL guarantee the code is not already present in the `pairing_codes` table
- **AND** on the (astronomically unlikely) event of a collision, SHALL retry the generation
- **AND** SHALL bound the retries (max 5 attempts) and return 500 if all attempts collide

#### Scenario: Source shows "waiting for pair" state
- **WHEN** a code has been issued and the target has not yet redeemed
- **THEN** the Add a device card SHALL display a "Waiting for another device to pair…" state with the countdown
- **AND** the source SHALL detect successful pairing when its next pull returns data from the new device (e.g., the target's existing flags)

#### Scenario: Target redeems a valid code
- **WHEN** the user enters an 8-character code on a target device and activates "Pair"
- **THEN** the client SHALL call `POST /sync/redeem { code }`
- **AND** on a 200 response, SHALL store the returned sync key in IndexedDB
- **AND** SHALL trigger a full pull
- **AND** the server SHALL delete the code (one-time use)

#### Scenario: Target redeems an unknown or expired code
- **WHEN** the user enters a code that the server does not recognize
- **THEN** the server SHALL respond with HTTP 404
- **AND** the client SHALL display an inline error ("Code not found or expired")

#### Scenario: Target redeems a malformed code
- **WHEN** the user enters a string that is not 8 characters from the allowed alphabet
- **THEN** the client SHALL display a validation error and SHALL NOT call the server

#### Scenario: Brute-force protection
- **WHEN** many redeem requests come from the same IP within a short window
- **THEN** the server SHALL rate-limit the requests (10 per minute per IP)
- **AND** SHALL respond with HTTP 429 and a `Retry-After` header

### Requirement: Enable sync clears state on failure

If `triggerFirstTime()` (and thus the initial push + pull) fails for any reason during `enableSync()`, the system SHALL call `disableSync()` to clear the local sync key, `lastSyncAt`, and dirty set. This ensures Settings shows the sync-off state on failure and a retry generates a fresh key rather than retrying a stale one.

#### Scenario: Enable sync fails and clears key
- **WHEN** an action turns sync on
- **AND** `triggerFirstTime()` throws (registration rate-limited, network failure, server error)
- **THEN** the system SHALL call `disableSync()` to clear local sync state
- **AND** the Devices section SHALL show the sync-off state
- **AND** the error SHALL propagate to the caller for UI surfacing

#### Scenario: Enable sync succeeds normally
- **WHEN** an action turns sync on
- **AND** `triggerFirstTime()` completes without error
- **THEN** the sync key SHALL remain stored
- **AND** the Devices section SHALL show the sync-on state

### Requirement: Sync enable errors surfaced in UI

When turning sync on fails, the card or section whose action turned it on SHALL display an inline error next to that action, with a Retry action, and SHALL log the error details to the browser console.

#### Scenario: Error shown on sync failure
- **WHEN** the user activates Add a device, Collect new posts while Lidora is closed, or Connect an agent
- **AND** turning sync on fails
- **THEN** an inline error message SHALL appear next to that action
- **AND** the error details SHALL be logged to the browser console via `console.error`

#### Scenario: Error cleared on next attempt
- **WHEN** a sync error message is displayed
- **AND** the user attempts the action again
- **THEN** the previous error message SHALL be cleared before the new attempt

### Requirement: Sync is opt-in

The system SHALL NOT enable, configure, or perform sync until the user takes an action that turns sync on: Add a device, Join from another device, Collect new posts while Lidora is closed, Connect an agent, approving an agent with an approval code, or opening a pairing link. Existing users SHALL see no change in behavior until they take one of these actions.

#### Scenario: User with sync disabled sees no sync activity
- **WHEN** sync is not enabled in the user's settings
- **THEN** no push requests SHALL be sent
- **AND** no pull requests SHALL be sent on boot or focus
- **AND** no `enqueueFeed`, `enqueueFeedDelete`, `enqueueFlag`, `enqueueOtp`, or `redeemCode` function SHALL be called from any non-sync path

#### Scenario: User enables sync for the first time
- **WHEN** the user takes an action that turns sync on with no prior key
- **THEN** a sync key SHALL be generated
- **AND** the first-time setup merge SHALL be triggered
- **AND** the Devices section SHALL show the sync-on state

#### Scenario: User enables sync mid-session
- **WHEN** the app has already booted
- **AND** the user takes an action that turns sync on
- **THEN** the first-time setup merge SHALL be triggered inline (not deferred to the next boot)
- **AND** the action that turned sync on SHALL show a busy state while the merge is in progress

### Requirement: Delete sync data from Settings

When this device has a sync key, the Server data section SHALL offer a "Delete data from the server" action behind a danger confirmation dialog. The dialog SHALL state that the synced subscriptions, flags, statistics and agent access are deleted from the server, that other paired devices will stop syncing, and that reading data on this device is kept. On confirmation the client SHALL call `DELETE /sync/account` and, when it succeeds, call `disableSync()` and show the Devices section. A `401` response SHALL count as success, because the server no longer holds the account. Any other failure SHALL leave sync enabled and keep the dialog open with "Couldn't delete the data from the server. Try again." Local feeds, items, flags and statistics SHALL NOT be changed.

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

#### Scenario: Re-enabling after deletion
- **WHEN** the user turns sync on after deleting sync data
- **THEN** a new sync key SHALL be generated and registered

### Requirement: Regeneration rotates the key and preserves local state

Regenerating the sync key (without disabling sync) SHALL preserve the local dirty set and `lastSyncAt`. The user wants continuity of state across the regeneration. Settings SHALL present regeneration as "Sign out other devices and agents" in the Server data section. The client SHALL store the new key locally and then call `POST /sync/rotate` with the old key in the `X-Sync-Key` header and the new key in the body. The server registers the new key and marks the old key's account rotated in one batch. A `401` is never recovered by registering: a key the server rejects stays rejected, and the client handles it as defined by the requirement "A rejected sync key is not retried".

#### Scenario: User regenerates the key
- **WHEN** the user activates "Sign out other devices and agents" and confirms
- **THEN** the system SHALL generate a new sync key
- **AND** SHALL replace the local sync key
- **AND** SHALL preserve the dirty set
- **AND** SHALL preserve `lastSyncAt`
- **AND** SHALL call `POST /sync/rotate`, which registers the new key and rotates the old one, so that the next push or pull with the new key is authenticated

#### Scenario: Rotation request fails
- **WHEN** the user regenerates the key and `POST /sync/rotate` fails
- **THEN** the new key SHALL remain stored locally and the failure SHALL be logged with `console.error`
- **AND** the confirmation SHALL show that the other devices and agents could not be signed out
- **AND** the new key SHALL NOT be registered by any automatic retry
- **AND** the next sync request SHALL receive `401` and SHALL be handled as a rejected sync key

#### Scenario: 401 is not auto-registered
- **WHEN** the server returns `401` for a sync request
- **THEN** the client SHALL NOT call `POST /sync/register` and SHALL NOT retry the request
- **AND** the only client paths that register a key are turning sync on, pairing, issuing a pairing code and rotation, each an explicit user action

### Requirement: Rotation revokes a lost or stolen device's key

The system SHALL provide no key revocation other than rotation. The only remediation for a stolen device is to regenerate the key on a trusted device and pair the other devices again. Rotation SHALL take effect at once: the server SHALL reject the old key and every agent token minted under it with `401`, and `POST /sync/register` SHALL refuse to register the old key while its rotated account exists (`403`). Rotation does not move data; the old account's rows stay on the server, unreadable through the API, until the daily cron deletes them 30 days after rotation.

#### Scenario: User regenerates key after device loss
- **WHEN** the user opens Settings → Server data on a trusted device
- **AND** activates "Sign out other devices and agents" and confirms
- **THEN** a new sync key SHALL be generated
- **AND** the new key SHALL be stored locally and registered on the server
- **AND** no data SHALL be migrated from the old account to the new one on the server

#### Scenario: Stolen device's key is rejected after rotation
- **WHEN** a stolen device presents the previous sync key after rotation
- **THEN** the server SHALL respond `401` to push, pull and every other authenticated route
- **AND** agent tokens minted under the old key SHALL be rejected with `401`
- **AND** the action's description in Settings SHALL state that it is the way to remove access from a lost device or an agent, and the confirmation SHALL state that other devices must be added again and agents reconnected

#### Scenario: Old account is erased after the grace period
- **WHEN** 30 days have passed since the rotation
- **THEN** the daily cron SHALL delete the old account and its rows, as defined by the requirement "Retention of rotated and inactive accounts"

### Requirement: A rejected sync key is not retried

When a sync request receives `401`, the client SHALL fail that request once, without retrying it, with the message "The server no longer recognises this sync key. Join from another device again, or stop syncing on this device." It SHALL record the message as the last sync error and show it in the Devices section of Settings. Until a sync request succeeds or sync is disabled, the client SHALL NOT start focus, online or visibility pulls or debounced pushes; an explicit action (Sync now, a manual refresh) SHALL still try once. Changes made meanwhile SHALL stay queued. Disabling sync SHALL clear the recorded error.

#### Scenario: Account deleted on another device
- **WHEN** a paired device syncs after another device deleted the account
- **THEN** the pull SHALL fail once with the message above
- **AND** the Devices section SHALL show the message
- **AND** no further automatic request SHALL be sent

#### Scenario: Explicit retry
- **WHEN** the user chooses Sync now while the key is rejected
- **THEN** the client SHALL send one request
- **AND** if it succeeds, automatic syncing SHALL resume

#### Scenario: Local changes while rejected
- **WHEN** the user marks items read while the key is rejected
- **THEN** the changes SHALL remain in the dirty set
- **AND** no push SHALL be sent

## REMOVED Requirements

### Requirement: Sync status UI in Settings

**Reason**: The Sync section is split into the Devices section (own devices), the Agents section and the Server data section (account-wide actions), and sync is no longer a switch.
**Migration**: See "Devices section", "Server data section" and "Account-wide sync actions", and the `agent-connector` requirement "Connect an agent screen".

### Requirement: Unified pairing modal

**Reason**: Pairing moves from a modal to two pages in the Devices section, and the two directions are offered as separate actions.
**Migration**: See "Add a device card", "Join from another device card" and "Pair link results".

### Requirement: Pairing via QR code (deferred scanning in v1)

**Reason**: Out of date. The QR code encodes the pair URL with a one-time code, not the sync key, and camera scanning is implemented.
**Migration**: See "Add a device card" and the `qr-scanner` capability.

### Requirement: Agent access management

**Reason**: Agents move to their own Settings section, separate from device sync.
**Migration**: See the `agent-connector` requirement "Connect an agent screen".
