## ADDED Requirements

### Requirement: Fetch feeds on arrival

When a sync pull, first-time sync setup or subscription adds a feed that has never been fetched and has no pending retry, the client SHALL start fetching it without waiting for the scheduler's periodic tick. The fetch SHALL use the same per-feed refresh path, concurrency limit and error handling as scheduled refreshes, and SHALL NOT activate manual-refresh feedback.

#### Scenario: Agent adds a feed

- **WHEN** an agent subscribes to a feed through MCP
- **AND** the next sync pull on an open device adds that feed
- **THEN** the device SHALL begin fetching the feed as soon as the pull has applied it

#### Scenario: Sample feeds

- **WHEN** a new reader adds the sample feeds from the welcome screen
- **THEN** both feeds SHALL be fetched without waiting for a scheduler tick

#### Scenario: Feed already has items from the dialog

- **WHEN** the Add feed dialog stores the items it previewed and records a fetch time
- **THEN** the feed SHALL NOT be fetched again on arrival

### Requirement: River shows a first fetch in progress

When the river has no items to show and every feed in its selection with a URL has never been fetched, the river SHALL show a loading message naming the feed, or "Fetching your new feeds…" for several, instead of the empty state. This SHALL hold from the moment the feed is listed, including while a sync pull runs before the fetch starts.

#### Scenario: Selecting a new feed

- **WHEN** the user selects a feed that has not yet been fetched
- **THEN** the river SHALL show "Fetching <feed title>…"
- **AND** SHALL NOT show "No items yet."

#### Scenario: Fetched feed with no items

- **WHEN** the selected feed has been fetched and returned no items
- **THEN** the river SHALL show the empty state

### Requirement: River shows a failed first fetch

When the river has no items to show and its selection is a single feed whose most recent fetch reported an error, the river SHALL show that the feed could not be fetched, the error message, and a "Try again" button that refreshes the feed with manual-refresh feedback. Because the user asked for it, "Try again" SHALL ignore the client's retry backoff unless the last failure was a `429` or `419`; the server's origin governor and cooldowns still apply.

#### Scenario: Unreachable feed

- **WHEN** the first fetch of the selected feed fails with an upstream error
- **THEN** the river SHALL show the error and a "Try again" button
- **AND** activating "Try again" SHALL fetch the feed even though its retry time has not passed
- **AND** SHALL disable the button until the refresh completes

#### Scenario: Rate-limited feed

- **WHEN** the first fetch of the selected feed failed with `429` and its retry time has not passed
- **THEN** "Try again" SHALL NOT contact the feed before that time

### Requirement: Empty-state refresh action shows progress

The empty-state "Check for new items" action SHALL be a button. While any manual refresh is in progress it SHALL be disabled, read "Checking…" and set `aria-busy`, and it SHALL return to its idle label when the refresh completes or fails.

#### Scenario: Checking an empty feed

- **WHEN** the user activates "Check for new items"
- **THEN** the button SHALL read "Checking…" and be disabled before any network request completes
- **AND** SHALL read "Check for new items" again once the refresh finishes
