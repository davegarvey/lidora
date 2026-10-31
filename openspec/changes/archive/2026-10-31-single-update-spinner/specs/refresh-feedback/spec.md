## MODIFIED Requirements

### Requirement: Optimistic visual feedback on refresh-all click

When the user triggers a manual refresh of the current feed selection, the UI SHALL provide immediate visual confirmation that the click was received, before any async work begins. Background feed fetches SHALL not activate this manual-refresh feedback. The shared header activity cue SHALL report ongoing work after its existing delay; the manual action SHALL expose its busy state accessibly without rotating.

#### Scenario: Refresh button shows spinning icon on click
- **WHEN** the user clicks the Refresh button, presses `r`, triggers refresh through the command palette, or activates the empty-state refresh link
- **THEN** the refresh icon SHALL remain still and the button SHALL become disabled synchronously, before any network or IndexedDB operation has completed
- **AND** the accessible name SHALL describe whether the action refreshes all feeds, one feed, or the selected tag feeds

#### Scenario: Visual feedback persists through fetch cycle
- **WHEN** manually refreshing a selected feed scope
- **THEN** the button SHALL remain disabled and its icon SHALL remain still from the moment of the action until sync ingestion, targeted feed processing, relevant storage cleanup, final list reconciliation and a visible rendering opportunity complete, with no gap where the button reverts to its idle state

#### Scenario: Error during refresh does not leave button stuck
- **WHEN** a manual refresh action encounters an error, including a sync server failure, feed fetch failure, or IndexedDB error
- **THEN** the manual activity state SHALL be released in a `finally` block after necessary reconciliation attempts so the button and icon return to their idle state regardless of error

### Requirement: Background auto-refresh does not show optimistic feedback
The background tick SHALL NOT trigger optimistic visual feedback, since there is no user action to acknowledge.

#### Scenario: Background tick does not disable button
- **WHEN** the periodic auto-refresh tick runs
- **THEN** the refresh button SHALL remain enabled unless a manual refresh is in progress, and its icon SHALL remain still
