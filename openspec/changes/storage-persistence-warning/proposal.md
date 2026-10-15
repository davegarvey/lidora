# Storage persistence warning

## Why

Settings > Storage showed non-persistent storage twice: a row at the top ("Your browser may clear Lidora's data when space runs low" with **Keep data on this device**) and "Persistent storage: Off" in the details list. The two were not visibly connected, so the button was easy to miss. The button also implied that one click fixed the risk. In practice browsers grant `navigator.storage.persist()` inconsistently: Chrome decides silently from engagement, Firefox prompts and Safari mostly grants it to installed apps. When the browser refused, nothing told the user.

Sync and backups protect a library more reliably than persistence does, but the warning did not mention them, and it overstated the risk for users who already sync.

## What Changes

- Replace the separate notice with a single warning row, "Persistent storage is off", shown only while persistence is not granted. The details list omits the persistence entry in that state and shows On or Unavailable otherwise.
- Make the warning explain what is at risk and what protects it, depending on sync:
  - sync on: subscriptions and reading state are synced, but articles are kept only on this device, so a backup keeps them;
  - sync off, server supports sync: download a backup, or add a device to sync subscriptions and reading state;
  - server without sync: download a backup.
- Rename the request action to **Ask browser to keep data** and keep it as a secondary button in the warning row.
- When the browser declines, say so and note that installing Lidora tends to help.
- Add a `--warning` theme token (darkened Latte peach for light themes, to meet 4.5:1 on the base; Mocha yellow for dark themes). The Mauve accent stays reserved for unread and selection.

## Impact

- `src/settings/StorageSection.tsx`, `src/settings/controls.tsx`, `src/styles.css`, `tests/settings-view.test.tsx`.
- Spec: `storage-retention` "Persistent storage and status". The unarchived `settings-page-redesign` change also modifies this requirement; archive it before this change so this text wins.
