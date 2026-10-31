# event-driven-refresh Specification

## Purpose
Keep the article list current by reloading it when the background scheduler or sync delivers changes, without redundant reloads during a manual refresh or overlapping reloads.

## Requirements

### Requirement: Scheduler callback triggers UI refresh
The scheduler SHALL notify after a refresh cycle processes at least one stale feed. If the user is active, the client SHALL reconcile feed/item data through the shared update coordinator. Reconciliation SHALL publish immediately only when the library-updates presentation policy permits; otherwise it SHALL prepare pending results. Idle users SHALL retain stored changes for the next permitted catch-up. The cycle's activity SHALL include its resulting reconciliation.

#### Scenario: Scheduler fetches new RSS items while user is active
- **WHEN** background feed processing completes while the user is active
- **THEN** the client SHALL reconcile the affected data
- **AND** a non-empty list with automatic arrivals off SHALL retain its displayed membership/order and offer Show

#### Scenario: Scheduler fetches new items while user is idle
- **WHEN** background feed processing completes while the user is idle
- **THEN** immediate UI reconciliation SHALL be deferred until permitted catch-up
- **AND** received items SHALL remain persisted

#### Scenario: Scheduler tick with no stale feeds
- **WHEN** the scheduler processes no stale feeds
- **THEN** it SHALL NOT trigger a redundant list reload

### Requirement: Sync callback triggers UI refresh
Sync SHALL notify when applying remote data that invalidates library presentation, including server-polled articles. Notifications SHALL enter the shared coordinator, which SHALL apply the library-updates presentation policy and include reconciliation in activity. First-time setup SHALL prepare a current initial presentation regardless of idle state. Empty unchanged pulls SHALL NOT cause a redundant list reload.

#### Scenario: Sync pull returns new data while user is active
- **WHEN** a sync pull applies remote flags and later ingests articles
- **THEN** each relevant revision SHALL be reconciled without prematurely declaring activity settled
- **AND** an existing non-empty list SHALL follow the automatic-arrival preference

#### Scenario: First-time sync setup
- **WHEN** first-time sync setup populates an initially empty library
- **THEN** the reconciled results SHALL be shown automatically regardless of idle state

#### Scenario: Sync pull returns no new data
- **WHEN** a pull changes no relevant feeds, flags or articles
- **THEN** it SHALL NOT trigger a redundant list reload

### Requirement: Manual refresh suppresses callbacks

The manual refresh operation SHALL suppress scheduler and sync callbacks to prevent redundant reloads. It SHALL snapshot the concrete feed IDs in the selection when the action begins, refresh only those feeds, and preserve the existing sync pull and final UI reload behavior. Repeated manual actions received while one is running SHALL be coalesced rather than starting a second concurrent manual refresh.

#### Scenario: User clicks "Refresh all"
- **WHEN** the user activates the Refresh button or "Check for new items" while All is selected
- **THEN** the scheduler and sync callbacks SHALL be temporarily suppressed
- **AND** the system SHALL pull remote sync state once
- **AND** every feed subscribed when the action began SHALL be force-refreshed once
- **AND** feeds added by the sync pull after the action began SHALL not be fetched by that action
- **AND** the feeds and items SHALL each be reloaded once after the refresh completes

#### Scenario: User manually refreshes one feed
- **WHEN** the user activates a manual refresh while a single feed is selected
- **THEN** only that selected feed SHALL be force-refreshed
- **AND** feeds outside the selection SHALL not be fetched by that action
- **AND** the feeds and items SHALL each be reloaded once after the refresh completes

#### Scenario: User manually refreshes a tag selection
- **WHEN** the user activates a manual refresh while one or more tags are selected
- **THEN** every feed matching at least one selected tag SHALL be force-refreshed
- **AND** feeds matching none of the selected tags SHALL not be fetched by that action
- **AND** multiple selected tags SHALL use the existing OR semantics

#### Scenario: Repeated manual refresh actions
- **WHEN** the user presses `r` or activates a refresh control while another manual refresh is running
- **THEN** the existing manual refresh SHALL continue
- **AND** a second concurrent manual refresh SHALL not start

#### Scenario: Manual refresh recovers from a fetch error
- **WHEN** a targeted feed refresh rejects due to an unexpected fetch or storage error
- **THEN** the feeds and items reloads SHALL still be attempted
- **AND** the manual in-flight state SHALL be cleared after those reload attempts

#### Scenario: Active selection matches no feeds
- **WHEN** a manual refresh begins with an active feed or tag selection that resolves to no subscribed feeds
- **THEN** no upstream feed SHALL be fetched
- **AND** the normal final feeds and items reloads SHALL still occur

### Requirement: `reloadItems()` SHALL be re-entrant safe
The client SHALL coalesce overlapping list reconciliation requests without losing data invalidations. A newer data revision or selection arriving during a query SHALL cause reconciliation to repeat until the result represents the latest requested revision and selection. Awaiters SHALL resolve only after the corresponding reconciliation is complete; outdated results SHALL NOT overwrite the current selection.

#### Scenario: Multiple triggers race
- **WHEN** a list query is in flight and a newer write invalidates it
- **THEN** the client SHALL schedule another reconciliation pass
- **AND** awaiting the update SHALL NOT resolve with an obsolete snapshot treated as final

#### Scenario: Selection changes during a query
- **WHEN** the selected feed or filters change before a query completes
- **THEN** the old query SHALL NOT publish its result into the new selection
