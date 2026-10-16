# Confirm before a pair link switches an active sync

## Why

Opening a `?pair=<code>` link pairs at once. On a device that already syncs, that silently moves it to the other sync, and first-time setup then uploads this device's subscriptions, read and starred flags and statistics into the other account. Anyone who can get the user to open a link or scan a QR code with the phone's camera can collect a copy of their library this way. Manual verification of the settings redesign confirmed that a syncing device switched without any prompt.

## What changes

- When this device has a sync key, a pair link does not redeem the code. It opens Settings → Devices with the "Join a different sync instead" panel expanded, the code filled in and the existing warning that joining leaves the current sync. The user confirms with Pair.
- A device without a sync key keeps the current behaviour: the link pairs at once.
- A failed startup sync no longer aborts startup before the pair link is handled. Previously a device whose key the server rejects, such as one signed out by a key rotation, ignored pair links and kept the query in the URL.

## Impact

Startup pair-link handling in `src/state.tsx` and the Devices section. No server or storage change. The scanner inside the join card is unchanged, because the user reaches it through the join panel and its warning.
