# Design

## Context

Settings is rendered by `SettingsDrawer` inside the shared modal `Backdrop`. Sub-flows open further modals by replacing `state.modal`. Only the `confirm` kind carries a `returnTo`, so the pairing modal and Agent access lose their way back to Settings. The Stats view already shows the pattern this change follows: a `view` in app state, a URL (`/stats`) written with `history.pushState`, and a `popstate` handler that restores it.

The sync key is the account for both devices and agents. Agent connections are minted and listed with the master key, agents read the server copy of the data, rotation revokes every agent, and account deletion removes agent access. The redesign separates devices and agents in the interface but keeps this single account. The account-wide actions are therefore placed in a section of their own, not under either feature.

## Goals and non-goals

Goals:

- One way of navigating Settings, with working back, Escape and deep links.
- Each section answers one question a user has: how Sift looks, what I subscribe to, how my devices stay in step, which assistants can use Sift, how much this browser stores, what the server holds, and what this app is.
- No sync switch: sync turns on as a consequence of an action whose purpose the user understands.
- Accessible controls and consistent feedback for every action.
- No stacked modals. The page has room to show most flows in place, so pairing, the OPML preview and recoverable confirmations expand within their section. A dialog is used only where interruption is the point: confirming irreversible or account-wide actions.

Non-goals: new settings, backend changes to agent credentials, a command-palette entry for each section.

## Navigation and routes

`ViewKind` gains `settings`. App state gains `settingsPath`, one of:

| Path | Content |
|---|---|
| `/settings` | Section list on narrow screens; Appearance on wide screens |
| `/settings/appearance` | Appearance |
| `/settings/subscriptions` | Subscriptions |
| `/settings/devices` | Devices |
| `/settings/agents` | Agents |
| `/settings/storage` | Storage |
| `/settings/server-data` | Server data |
| `/settings/about` | About |

`src/routing.ts` gains `parseSettingsPath` and `settingsUrl`, replacing the single `isStatsPath` check with a small path parser for both views. An unknown section path, or a sync-only section when sync is unavailable, falls back to `/settings`.

History rules:

- Opening Settings from anywhere pushes one entry. Closing Settings (the close button, Escape at the top level, or a narrow-screen back from the section list) calls `history.back()` when Settings was entered within the app, and otherwise replaces the entry with `/`.
- On wide screens, choosing another section **replaces** the entry, so Back leaves Settings rather than stepping through every section viewed.
- On narrow screens, opening a section from the list pushes an entry, so Back returns to the list.
- `popstate` restores `view` and `settingsPath` from the URL, as it does for Stats.

The sidebar's Settings item behaves like Stats: it is marked `aria-current="page"` and given the active style while Settings is open. The River's empty-state links open `/settings/subscriptions` (Import OPML) and `/settings/devices` (Pair a device) directly.

## Layout

On wide screens (above the app's 768 px breakpoint) Settings replaces the river or reading pane in the main column, and the sidebar remains. The main column contains:

- a header with the heading "Settings" and a close button (Lucide `X`);
- a section navigation list (about 180 px wide), using the existing selection style (Mauve) for the current section;
- the section content, at most 640 px wide.

On narrow screens Settings is full width. `/settings` shows the section list as large rows with a chevron. A section shows a header with a back button (Lucide `ChevronLeft`) and the section name.

Each section is a heading followed by groups of rows. A row has a label, an optional one-sentence description beneath it, and a control or value aligned to the end. A light separator divides rows within a group. Values that need more than one line (the sync status, the pairing cards and connected agents) are rendered as cards, not rows.

## Inline flows and the remaining dialog

The original problems came from modals stacked on modals, not from modals as such. Settings therefore follows one rule: at most one layer above the page, and never a layer that opens another.

- **Expanding panels.** A button with `aria-expanded` and `aria-controls` reveals a panel directly beneath it. Opening a panel moves focus to its first control, or to its first sentence for panels with no input. Escape or Cancel collapses the panel and returns focus to the button. At most one panel is expanded per section, and leaving the section collapses it. Panel state is held in component state, not in the URL. Pairing and the OPML import preview use panels.
- **Inline confirmation for recoverable actions.** Revoking an agent (it can be connected again) and stopping sync on this device (it can rejoin from another device) expand a confirmation under their row. The panel states the consequences and has a confirm button, placed apart from the trigger, and Cancel. While the action runs, both buttons are disabled and the confirm button shows a busy label. A failure keeps the panel open with the error.
- **A dialog for irreversible or account-wide actions.** Deleting data from the server cannot be undone, and signing out other devices and agents disrupts every device and agent. Both are confirmed in a modal dialog (see Confirmation dialog). Interruption is the purpose here: a dialog cannot be scrolled past, and screen readers announce it reliably.
- **The QR scanner stays a full-screen overlay.** Nearly all scanning happens on phones, where a full-screen camera view is the convention and is easier to aim. The overlay opens from a single card and returns to it, so it does not stack.

Escape is handled from the top layer down: the scanner or dialog closes first, then an expanded panel collapses, and only then does Escape close Settings. A focused input with a value keeps its normal Escape behaviour.

## Components

`src/settings/` contains:

- `SettingsView`: routing, layout, header and section navigation.
- one component per section, plus `AddDeviceCard` and `JoinDeviceCard`.
- shared controls in `src/settings/controls.tsx`:
  - `SettingRow`: a label and description, linked to the control by `id`.
  - `Switch`: a `<button role="switch" aria-checked>` labelled by its row. When on, it uses `--green`, so Mauve stays reserved for unread and selection.
  - `SegmentedControl`: a `radiogroup` of buttons with arrow-key movement.
  - `ActionButton`: shows a busy label and disables itself while its promise is pending.
  - `InlineMessage`: errors with `role="alert"` and success messages with `role="status"`, shown next to the control that caused them.
  - `ExpandingPanel`: the disclosure behaviour above, including focus and Escape handling.
  - `InlineConfirm`: an `ExpandingPanel` with consequence text, a busy-aware confirm button and Cancel.
  - `DangerAction`: a row with a consequence sentence and a red outlined button, which opens either an `InlineConfirm` or the confirmation dialog.

The existing `PairDeviceModal`, `PairResultModal`, `AgentsModal` and `SettingsDrawer` are deleted. The pairing and agent logic moves into the new components largely unchanged, and their inline styles move to `styles.css`. `QrScannerOverlay` is kept as a full-screen overlay. It reports its result to the card that opened it instead of opening the pair-result modal.

## Sections

### Appearance

- **Theme**: a segmented control with System, Light and Dark.
- **High contrast**: a switch.

### Subscriptions

- A summary line: "42 feeds".
- **Export subscriptions**: downloads `sift-subscriptions.opml`. Disabled when there are no feeds.
- **Import from OPML**: opens the file picker. After a file is read, an expanding panel in place of the confirmation modal shows the number of new feeds and the number already subscribed, with Import and Cancel. A file that cannot be parsed, or one that contains no feeds, shows an inline error.

### Devices

Sync off: one sentence ("Keep your subscriptions and reading progress in step across your devices. There is no account; your devices share a private key."), then two cards side by side on wide screens and stacked on narrow ones.

- **Add a device.** The card has one button. Activating it turns sync on (`enableSync`), issues a pairing code and expands the card to show it. If turning sync on fails, the card shows "Couldn't turn on sync" with Retry, and sync stays off.
- **Join from another device.** The card shows the "Pairing code" field, **Pair** and a **Scan** icon button immediately, with no extra step. The field is wide enough for a 22-character key, and a "Use a sync key instead" disclosure explains the key format. When no camera is detected, Scan is disabled and a line of text says why.

When `/sync/capabilities` reports `items: true`, a secondary action below the cards, **Collect new posts while Sift is closed**, turns sync on for this device alone. Its description says that this stores the subscriptions on this Sift server.

Sync on:

- A status card shows the status text ("Synced 2 minutes ago", "3 changes waiting to sync", "Never synced"), with **Sync now**. A failed sync shows "Sync failed 5 minutes ago" and the error message in full beneath it, not in a tooltip. A rejected key shows the rejection message and a link to Server data.
- The **Add a device** card, collapsed until activated.
- A secondary link, **Join a different sync instead**, expands the join card beneath it, with a warning that this device will leave its current sync.

The expanded Add a device card keeps today's pairing behaviour: the code, shown as `abcd-efgh` with a copy button, a QR code for the pair URL, the countdown ring and "Expires in 4:12", and "Waiting for another device to pair…". A code is issued only when the card is expanded, because codes expire and are rate-limited, and it refreshes while the card stays open. Collapsing the card or leaving the section clears its timers. When a code cannot be issued, the card shows an error and Retry.

Joining succeeds in place: the cards are replaced by the sync-on view with the status message "This device is now syncing". On failure the error appears under the field and the value is kept. Scan opens the full-screen scanner; cancelling it returns to the card.

The `?pair=` boot flow redeems the code as now. On success it opens `/settings/devices` with the success message. On failure it opens `/settings/devices` with the join card expanded, the code filled in and the error shown.

### Agents

- One sentence: "Let an AI assistant read and manage your feeds through MCP."
- When sync is off, a note under the button says: "Agents use the copy of your subscriptions and reading progress stored on this Sift server. Connecting one turns this on." **Connect an agent** then calls `enableSync` before minting the link. A failure is shown inline and leaves sync off.
- The connection link panel is unchanged in function. The "setup instructions copied" confirmation becomes a separate status line with a check icon, and an expired link says "This link has expired" above **Create a new link**.
- A **Connected agents** heading, then one of: a loading line, "No agents connected", a load error with Retry, or the agent list (unchanged identity and inline rename). Revoke expands an inline confirmation within the agent's row ("Revoke access for Claude? It loses access immediately and can be connected again later."). The list reloads after a revoke, and a failed revoke keeps the confirmation open with the error.
- The "Have an approval code?" disclosure stays collapsed by default, because it is a rarely used fallback. It follows the same sync-off rule as Connect an agent, and its Scan button opens the same full-screen scanner.

### Storage

- A summary line: "72 KB used · 1,204 articles". Sizes use KB, MB or GB.
- When storage is not persistent: "Your browser may clear Sift's data when space runs low", with **Keep data on this device** (the persistence request).
- Beneath the summary, a short list shows quota, persistence state, article records and saved article bodies, using "Unavailable" when the browser reports nothing. There is room to show this without a disclosure.

### Server data

Shown only when this device has a sync key.

- One sentence listing what the server holds: subscriptions, read and starred state, statistics and agent access.
- **Key ID**: the four-character fingerprint, in small text, with the note "Matches on every device in the same sync".
- **Sign out other devices and agents** (key rotation). Description: "Use this if a device is lost or an agent should no longer have access. Your other devices will need to be added again and agents reconnected."
- **Stop syncing on this device**. Description: "This device keeps its data but stops syncing. Your other devices and agents are unaffected."
- **Delete data from the server**, in danger styling. Description: "Removes everything Sift stores on the server for your devices and agents. Data on this device is kept."

Stop syncing expands an inline confirmation under its row. Sign out other devices and agents, and Delete data from the server, open the confirmation dialog. Each confirmation states the consequences in full. "Stop syncing" adds, when agents are connected, that agents will now only see changes made on other devices. After "Stop syncing" or "Delete", the app navigates to Devices, because Server data no longer applies.

### About

Version, a GitHub link, a Keyboard shortcuts row that opens the shortcuts overlay, and links to About, Privacy and Terms.

## Confirmation dialog

`ConfirmModal` is rebuilt on a native `<dialog>` opened with `showModal()`, which gives focus containment, Escape handling and `aria-modal` semantics without custom code. While `onConfirm` runs, both buttons are disabled and the confirm button shows its busy label ("Deleting…"). If `onConfirm` throws, the dialog stays open and shows the error, so callers rethrow instead of swallowing failures. On close, focus returns to the control that opened the dialog. `returnTo` is removed: the page stays underneath, so there is nothing to return to. The feed editor's delete confirmation gets the same improvements.

## Feedback rules

- Settings that change local state (theme, high contrast) apply immediately and need no confirmation.
- Every network action uses `ActionButton` and reports the outcome next to itself. No action reports only to the console.
- Messages use sentence case and say what to do next ("Check your connection and try again").

## Accessibility

- The view has a single `h1` ("Settings"), and each section has an `h2`. Navigating to a section moves focus to its heading.
- The section navigation is a `nav` labelled "Settings sections", with `aria-current="page"` on the current section.
- All controls are native buttons or inputs, labelled by their row.
- Status changes (sync status, copy confirmations) are announced with `role="status"`; errors use `role="alert"`.
- Touch targets stay at least 44 px on narrow screens, as today.

## Risks and trade-offs

- **Settings is no longer an overlay above the reading position.** Opening it replaces the river or reading pane. The river restores its scroll position on return (see `river-focus-restore`). Reading positions should be checked during implementation.
- **Implicit sync.** Turning sync on as a side effect of Add a device, Connect an agent or Collect new posts removes a decision point. Each of those actions states that it stores data on the server, and the Server data section is the single place to undo it.
- **More state within sections.** Expanding cards and inline confirmations make the Devices, Agents and Server data sections stateful. Allowing one expanded panel per section, and collapsing panels when the user leaves a section, keeps the page predictable. A pairing code exists only while its card is open.
- **Two confirmation patterns.** Using inline confirmation for recoverable actions and a dialog for irreversible ones is a deliberate distinction, not an inconsistency. The weight of the confirmation matches the cost of a mistake.
- **A larger change to the shell.** The new view touches routing and app state. Doing it in phases (see tasks) keeps each step reviewable, with the old components removed only once the page is complete.

## Open questions

- The `device-sync` "Key backup prompt" requirement describes a notice and a Copy button that the current app does not show. The redesign deliberately avoids exposing the raw key. The requirement should either be removed or replaced with an explicit "Copy sync key" action in Server data. This change leaves it untouched until that is decided.
