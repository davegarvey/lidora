# Settings page redesign

## Why

Settings began as a small modal and has grown with each feature. It now has five dialogs: Settings, the pairing modal, Agent access, the pair result and the confirmation dialog. None of them knows which dialog is beneath it, so closing Pair or Agent access also closes Settings. The modals have no dialog semantics or focus management, and their labels are not linked to their controls.

The Sync section is the hardest to understand. It combines three things a person does for different reasons:

- keeping their own devices in step (status, Sync now, pairing, joining);
- connecting AI assistants through MCP (Agent access);
- maintaining the server account (regenerating the key, the key fingerprint, disabling sync, deleting server data).

All three sit at the same level under one switch. Technical and destructive actions appear next to everyday ones. "Regenerate sync key" describes the mechanism, not what happens to the user's devices and agents.

Other problems are smaller but follow the same pattern. Storage shows four technical rows. The quota is printed in megabytes ("12605.7 MB"). Confirmations give no progress or error feedback. Failures in several places are only written to the console.

## What Changes

- **Settings becomes a page.** Settings is a full view with its own URLs (`/settings` and `/settings/<section>`), like `/stats`, and no longer a modal. On desktop it fills the main column, with a section list beside the content. On narrow screens the section list and each section are separate screens with a back button. The browser's back button and Escape work as they do elsewhere in the app.
- **Sections are organised by purpose:** Appearance, Subscriptions, Devices, Agents, Storage, Server data and About. Devices, Agents and Server data appear only when the server supports sync.
- **Devices** covers the user's own devices only: sync status, Sync now, Add a device and Join from another device. There is no sync switch. Adding or joining a device turns sync on. Where the server polls feeds, a secondary action turns sync on for this device alone, so new posts are collected while Lidora is closed.
- **Agents** is a section of its own and does not mention sync or keys. Connecting the first agent turns sync on, and the section says that agents read the copy of the subscriptions and reading progress stored on the server.
- **Server data** collects the actions that affect the whole server account and every device and agent: "Sign out other devices and agents" (key rotation), "Stop syncing on this device", "Delete data from the server", and the key ID for troubleshooting.
- **No stacked modals.** The original problems came from modals opening other modals. With a full page available, most flows happen in place, and at most one layer ever sits above the page:
  - Pairing becomes two cards in Devices. "Join from another device" shows its code field straight away. "Add a device" expands to show the pairing code and QR code. The pair-result modal is removed: success appears in the Devices status, and failures stay on the join form so the user can try again.
  - Recoverable actions (revoking an agent, stopping sync on this device) are confirmed inline under their row.
  - Irreversible or account-wide actions (deleting server data, signing out other devices and agents) keep a confirmation dialog, rebuilt on the native `<dialog>` element with a busy state and errors shown in the dialog.
  - The QR scanner stays a full-screen overlay, which suits phones, and returns to the card that opened it.
- **Clearer controls and feedback.** Theme becomes a segmented control. Switches are accessible buttons that use Catppuccin Green, not Mauve, when on. Every asynchronous action shows a busy state and reports errors next to its control. Storage becomes a one-line summary followed by a short list of details, and sizes are given in GB when appropriate. OPML import shows its preview inline and reports files it cannot parse.

## Capabilities

### New Capabilities

- `settings-page`: the Settings view, its routes, layout, sections, controls, feedback and accessibility.

### Modified Capabilities

- `device-sync`: replace the Sync section, the switch-based enable flow and the pairing modal with the Devices section, its pairing cards and the Server data section. Remove the stale requirement for a QR code that encodes the sync key, and move agent management to `agent-connector`.
- `qr-scanner`: replace the requirements written for the join and share modals with requirements for the pairing cards.
- `agent-connector`: move the Connect an agent screen to Settings → Agents, and let connecting an agent or approving a code turn sync on.
- `high-contrast-theme`: describe the theme and high-contrast controls in the Appearance section.
- `storage-retention`: describe the Storage summary and details.
- `public-site-pages`: move the About, Privacy and Terms links from the Settings footer to the About section.

## Impact

- **Client:** `src/components/SettingsDrawer.tsx`, `PairDeviceModal.tsx`, `PairResultModal.tsx` and `AgentsModal.tsx` are replaced by a `src/settings/` module. `ConfirmModal.tsx` (rebuilt on a native `<dialog>`), `QrScannerOverlay.tsx`, `src/state.tsx` (a `settings` view, the removal of the `settings`, `pair-device`, `pair-result` and `agents` modal kinds, and the `?pair=` boot flow), `src/routing.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/River.tsx` and `src/styles.css` all change.
- **Server:** Workers already falls back to the app shell for unknown paths (`not_found_handling = "single-page-application"`), and the service worker does the same for installed clients. The Node and Bun adapters register no app-shell fallback, so a direct request for `/settings` or a section (as for `/stats` today) must be checked there and given one if it is missing.
- **Docs:** the README's Settings → Sync → Agent access and Settings → Sync → Regenerate references change to Settings → Agents and Settings → Server data.

## Out of scope

- Separating agent credentials from the sync key in the backend. Agents read the server copy of the data, so they continue to depend on the sync account. This change separates them only in the interface.
- New settings. The redesign reorganises existing ones.
- Command-palette entries for individual settings sections.
- The `device-sync` "Key backup prompt" requirement, which the current app does not implement. See the design's open questions.
