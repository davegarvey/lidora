## 1. View and routing

- [x] 1.1 Add the `settings` view and `settingsPath` to app state, with `parseSettingsPath` and `settingsUrl` in `src/routing.ts` and unit tests for every path, unknown paths and sync-only paths when sync is unavailable.
- [x] 1.2 Implement the history rules (open pushes; wide-screen section switches replace; narrow-screen section opens push; panels never touch history; close returns or replaces with `/`) and restore the view on `popstate`.
- [x] 1.3 Handle Escape from the top layer down: the scanner or dialog closes first, then an expanded panel collapses, and Settings closes only when nothing is open and no input has focus.
- [x] 1.4 Point the sidebar Settings items (expanded and collapsed) and the River empty-state links at the new routes, with the active state and `aria-current`.
- [x] 1.5 Check direct requests for `/settings/...` on the Vite dev server, Workers, Node and Bun, and add an app-shell fallback to the Node and Bun adapters where it is missing.

## 2. Layout and shared controls

- [x] 2.1 Build `SettingsView` with the wide layout (header, close button, section navigation, content) and the narrow layout (section list, back headers).
- [x] 2.2 Add `SettingRow`, `Switch`, `SegmentedControl`, `ActionButton`, `InlineMessage`, `ExpandingPanel`, `InlineConfirm` and `DangerAction` in `src/settings/controls.tsx`, with tests for labelling, keyboard use, focus movement, one-panel-per-section, busy states and failed confirmations.
- [x] 2.3 Add the styles to `styles.css` using existing tokens: Green for switches that are on, `--red` for danger actions, and the selection style only for the current section. Keep touch targets at least 44 px on narrow screens.
- [x] 2.4 Move focus to the section heading on navigation.

## 3. Sections

- [x] 3.1 Appearance: theme segmented control and high-contrast switch.
- [x] 3.2 Subscriptions: feed count, Export (disabled with no feeds), and Import with an inline preview and an error for unreadable or empty files.
- [x] 3.3 Storage: summary line, persistence notice and action, the details list, and KB/MB/GB formatting with tests.
- [x] 3.4 About: version, repository link, Keyboard shortcuts action and public page links.

## 4. Devices, pairing and server data

- [ ] 4.1 Devices sync-off state: explanation, the Add a device and Join cards side by side (stacked on narrow screens), and Collect new posts while Sift is closed when `/sync/capabilities` reports `items: true`.
- [ ] 4.2 Devices sync-on state: status card with the full error text, Sync now, the collapsed Add a device card, Join a different sync instead, and the rejected-key message with a link to Server data.
- [ ] 4.3 Add a device card: turn sync on when needed, issue a code only on expansion, refresh it while open, clear timers on collapse or leaving, QR, copy, countdown and waiting text beside the code, and inline errors with Retry.
- [ ] 4.4 Join card: widened input, the sync key disclosure, Scan beside Pair, the no-camera text, the leaving-current-sync warning, success switching the section to sync-on in place, and errors that keep the entered value.
- [ ] 4.5 Make `QrScannerOverlay` report results to the card that opened it, instead of opening the pair-result modal.
- [ ] 4.6 Route `?pair=` boot results to the Devices section: the success status, or the join card expanded with the code filled in and the error shown.
- [ ] 4.7 Server data: description, key ID, Stop syncing with an inline confirmation (including the agents warning), and Sign out other devices and agents and Delete data from the server with the confirmation dialog, returning to Devices after stopping or deleting.
- [ ] 4.8 Update the rejected-key message in the sync status store.

## 5. Agents

- [ ] 5.1 Move Agent access into the Agents section, with the sync-off note and turning sync on before minting a link or approving a code.
- [ ] 5.2 Add the Connected agents heading and the loading, empty and error states, an inline revoke confirmation within each row, reload after revoke, and report rename and revoke failures.
- [ ] 5.3 Show the setup-instructions confirmation as a status line and the expired-link message.
- [ ] 5.4 Update the consent page's sync-off message to point to Settings → Agents.

## 6. Confirmation dialog and clean-up

- [ ] 6.1 Rebuild `ConfirmModal` on a native `<dialog>` with a busy state, errors shown in the dialog and focus return. Remove `returnTo` and its handling in `App.tsx`, make callers rethrow failures, and check the feed editor's delete confirmation still works.
- [ ] 6.2 Delete `SettingsDrawer`, `PairDeviceModal`, `PairResultModal` and `AgentsModal`, remove the `settings`, `pair-device`, `pair-result` and `agents` modal kinds, and remove unused styles (`.settings .*`, `.mcp-url-bar*`, `.sync-grid__label`, `.sync-grid__hint`).
- [ ] 6.3 Update the README's Settings paths (Settings → Agents, Settings → Server data) and any other text that describes the old Sync section.

## 7. Verification

- [ ] 7.1 Run typecheck, lint, tests and `openspec validate settings-page-redesign --strict`.
- [ ] 7.2 In the dev server, check every section on wide and narrow screens in light, dark and high-contrast themes, including back, Escape, reload and deep links.
- [ ] 7.3 Check pairing between two browser profiles, by code, by pair link and by scanning, starting from both sync-off and sync-on states, and confirm no pairing code is issued until Add a device is expanded.
- [ ] 7.4 Check with a screen reader that switches, the theme control, navigation and messages are announced.
