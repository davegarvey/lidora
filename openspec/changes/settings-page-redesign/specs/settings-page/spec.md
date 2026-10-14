## ADDED Requirements

### Requirement: Settings is a routed view

Settings SHALL be an app view, not a modal, addressed by `/settings` and `/settings/<section>`. A direct request or reload of any of these paths SHALL open the same view on every supported runtime. An unknown section path SHALL show `/settings`. Browser back and forward SHALL restore the Settings view and section from the URL.

#### Scenario: Open Settings from the sidebar
- **WHEN** the user selects Settings in the sidebar
- **THEN** the URL SHALL become `/settings`
- **AND** the Settings view SHALL replace the river or reading pane
- **AND** the sidebar's Settings item SHALL be marked as the current page

#### Scenario: Reload a section
- **WHEN** the user reloads `/settings/storage`
- **THEN** the Settings view SHALL open on the Storage section

#### Scenario: Unknown section
- **WHEN** the user opens `/settings/unknown`
- **THEN** the Settings view SHALL show `/settings`

#### Scenario: Close Settings
- **WHEN** the user activates the close button, or presses Escape with no panel expanded and no input focused
- **THEN** the app SHALL return to the view that was shown before Settings was opened
- **AND** when Settings was opened by a direct request, the app SHALL show the river at `/`

### Requirement: Settings navigation history

On wide screens, switching between sections SHALL replace the current history entry. On narrow screens, opening a section from the section list SHALL push an entry. Expanding or collapsing a panel within a section SHALL NOT change the URL or history.

#### Scenario: Back after browsing sections on a wide screen
- **WHEN** the user opens Settings, views Appearance, then Storage, then presses Back
- **THEN** the app SHALL leave Settings

#### Scenario: Back from a section on a narrow screen
- **WHEN** the user opens Storage from the section list on a narrow screen and presses Back
- **THEN** the section list SHALL be shown

#### Scenario: Panels do not add history
- **WHEN** the user expands Add a device and then presses Back
- **THEN** the app SHALL leave the Devices section as if the panel had not been opened

### Requirement: Settings layout

On screens wider than the app's narrow breakpoint, the Settings view SHALL show a header with the heading "Settings" and a close button, a section navigation list, and the current section's content, with the current section in the selection style. On narrow screens, `/settings` SHALL show the section list, and each section SHALL show a header with a back button and its title.

#### Scenario: Wide screen
- **WHEN** Settings is open on a wide screen
- **THEN** the sidebar, the section list and the section content SHALL be visible together

#### Scenario: Narrow screen
- **WHEN** the user opens `/settings` on a narrow screen
- **THEN** only the section list SHALL be shown
- **AND** choosing a section SHALL show that section with a back button

### Requirement: Settings sections

Settings SHALL have these sections, in order: Appearance, Subscriptions, Devices, Agents, Storage, Server data and About. Settings SHALL NOT have a Done or Save button, and changes to local preferences SHALL apply immediately.

#### Scenario: Theme change applies immediately
- **WHEN** the user selects Dark in Appearance
- **THEN** the dark theme SHALL apply at once and be saved

#### Scenario: About section
- **WHEN** the user opens About
- **THEN** it SHALL show the app version, a link to the source repository, a Keyboard shortcuts action and links to the public pages
- **AND** activating Keyboard shortcuts SHALL open the shortcuts overlay

### Requirement: Sync-dependent sections

Devices, Agents and Server data SHALL appear only when the server reports sync as available. Server data SHALL also require a sync key on this device. Until the capability check completes, these sections SHALL NOT be shown.

#### Scenario: Sync unavailable
- **WHEN** `/sync/capabilities` does not report sync
- **THEN** Devices, Agents and Server data SHALL NOT appear in the section list
- **AND** a request for any of their paths SHALL show `/settings`

#### Scenario: Sync capability not yet known
- **WHEN** the capability check has not completed
- **THEN** the sync-dependent sections SHALL NOT be shown until it completes

### Requirement: OPML import and export in Settings

The Subscriptions section SHALL show the number of subscribed feeds. Export subscriptions SHALL download `sift-subscriptions.opml` and SHALL be disabled when there are no feeds. Import from OPML SHALL show an inline preview of the new and already subscribed feeds, with Import and Cancel, before changing anything. An unreadable or empty file SHALL show an inline error.

#### Scenario: Import preview
- **WHEN** the user chooses an OPML file containing 12 feeds, 3 of which are already subscribed
- **THEN** the section SHALL show that 9 feeds will be added and 3 are already subscribed
- **AND** no feed SHALL be added until the user selects Import

#### Scenario: Import confirmed
- **WHEN** the user selects Import in the preview
- **THEN** the new feeds SHALL be merged and refreshed

#### Scenario: Invalid file
- **WHEN** the user chooses a file that is not valid OPML
- **THEN** the section SHALL show an error saying the file could not be read
- **AND** no feed SHALL be added

#### Scenario: Export with no feeds
- **WHEN** there are no subscribed feeds
- **THEN** Export subscriptions SHALL be disabled

### Requirement: Settings controls are accessible

Each switch SHALL be a `button` with `role="switch"` and `aria-checked`, labelled by its row, and SHALL use Catppuccin Green, not the Mauve accent, when on. The theme control SHALL be a radio group with arrow-key movement. Every row label SHALL be programmatically associated with its control.

#### Scenario: Screen reader announces a switch
- **WHEN** a screen reader focuses the high-contrast switch
- **THEN** it SHALL announce "High contrast, switch" and its state

#### Scenario: Keyboard use of the theme control
- **WHEN** the theme control has focus and the user presses the right arrow key
- **THEN** the next theme option SHALL be selected

### Requirement: Settings structure is accessible

The Settings view SHALL have one `h1` and one `h2` per section. The section navigation SHALL be a `nav` with `aria-current="page"` on the current section. Navigating to a section SHALL move focus to its heading.

#### Scenario: Navigate to a section
- **WHEN** the user chooses Storage in the section navigation
- **THEN** focus SHALL move to the Storage heading
- **AND** the Storage item SHALL have `aria-current="page"`

### Requirement: Settings actions report their outcome

Every Settings action that makes a network request or a persistent change SHALL disable itself and show a busy label while it runs, and SHALL report a failure next to itself with a message that says what to do next. Errors SHALL use `role="alert"` and confirmations `role="status"`. No failure SHALL be reported only to the console, and no information only in a tooltip.

#### Scenario: Action in progress
- **WHEN** the user activates Sync now
- **THEN** the button SHALL be disabled and read "Syncing…" until the sync finishes

#### Scenario: Action fails
- **WHEN** renaming an agent fails
- **THEN** an error SHALL be shown next to the agent list
- **AND** the agent SHALL keep its previous name

### Requirement: Settings does not stack modals

Settings SHALL NOT use sub-pages, and SHALL NOT open a dialog or overlay from another dialog or overlay. Pairing, OPML import previews and confirmations of recoverable actions SHALL expand in place within their section. Only one panel SHALL be expanded per section, and leaving a section SHALL collapse it. The only layers above the page SHALL be the confirmation dialog, the QR scanner and the keyboard shortcuts overlay.

#### Scenario: Expanding a second panel
- **WHEN** a panel is expanded and the user expands another panel in the same section
- **THEN** the first panel SHALL collapse

#### Scenario: Leaving a section
- **WHEN** the user leaves a section with an expanded panel and returns to it
- **THEN** the panel SHALL be collapsed

#### Scenario: Closing a layer
- **WHEN** the user closes the scanner or a confirmation dialog
- **THEN** the Settings section that opened it SHALL be shown unchanged

### Requirement: Expanding panels are accessible

The control that expands a panel SHALL be a button with `aria-expanded` and `aria-controls`. Expanding a panel SHALL move focus to its first control, or to its first sentence when it has no control. Escape or Cancel SHALL collapse the panel and return focus to the button. Escape SHALL close Settings only when no dialog, scanner or panel is open.

#### Scenario: Escape in a panel
- **WHEN** a panel is expanded and the user presses Escape
- **THEN** the panel SHALL collapse
- **AND** focus SHALL return to the button that expanded it
- **AND** Settings SHALL remain open

### Requirement: Inline confirmation

Recoverable destructive actions, such as revoking an agent or stopping sync on this device, SHALL be confirmed in a panel that expands under the action. The panel SHALL state the consequences and SHALL have a confirm button, placed apart from the trigger, and Cancel. While the action runs, both buttons SHALL be disabled and the confirm button SHALL show a busy label. If the action fails, the panel SHALL stay open and show the error.

#### Scenario: Confirmed action succeeds
- **WHEN** the user confirms Stop syncing on this device and it succeeds
- **THEN** the panel SHALL close
- **AND** Settings SHALL remain open

#### Scenario: Confirmed action fails
- **WHEN** the user confirms an inline action and it fails
- **THEN** the panel SHALL remain open with the error shown
- **AND** the user SHALL be able to retry or cancel

#### Scenario: Double activation
- **WHEN** the user double-clicks a destructive action's button
- **THEN** the confirmation panel SHALL open
- **AND** the action SHALL NOT run

### Requirement: Confirmation dialog

Irreversible or account-wide actions, namely deleting data from the server and signing out other devices and agents, SHALL be confirmed in a native modal `<dialog>` that contains focus, closes on Escape and returns focus to the control that opened it. While the action runs, both buttons SHALL be disabled and the confirm button SHALL show a busy label. If the action fails, the dialog SHALL stay open and show the error.

#### Scenario: Dialog action succeeds
- **WHEN** the user confirms Delete data from the server and the request succeeds
- **THEN** the dialog SHALL close
- **AND** Settings SHALL remain open

#### Scenario: Dialog action fails
- **WHEN** the user confirms an action in the dialog and it fails
- **THEN** the dialog SHALL remain open with the error shown
- **AND** the user SHALL be able to retry or cancel

#### Scenario: Escape in a dialog
- **WHEN** a confirmation dialog is open and the user presses Escape
- **THEN** the dialog SHALL close
- **AND** focus SHALL return to the button that opened it
- **AND** the Settings section beneath SHALL remain open
