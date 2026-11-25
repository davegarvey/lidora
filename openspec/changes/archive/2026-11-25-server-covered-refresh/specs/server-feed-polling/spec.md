## MODIFIED Requirements

### Requirement: Paginated items pull

`GET /sync/items?after=<seq>` SHALL accept the same credentials as `/sync/pull`, apply its own per-key rate limit and send `Cache-Control: no-store`. It SHALL return up to 200 items with a sequence greater than `after` that belong to the caller's live subscriptions (limited to the 500 with the lowest feed IDs), each with the caller's `feed_id` and without the feed URL, ordered by sequence, together with `cursor` and `more`. When the page is full, `cursor` SHALL be the last returned sequence and `more` SHALL be true. Otherwise `cursor` SHALL be the highest sequence that existed when the request started and `more` SHALL be false. An item SHALL appear once per page even when the caller has several live feed rows with its URL.

When `more` is false, the response SHALL include `covered`: one entry per feed ID among those same subscriptions whose URL the server is polling successfully, with `feed_id`, `polled_at` (the time the last poll outcome was recorded) and `next_poll_at`. A feed SHALL be covered only when its polling state has no consecutive failures, its last status is `200` or `304`, and its next poll is no more than 60 minutes overdue. Responses with `more` true SHALL NOT include `covered`.

#### Scenario: Items for other accounts' feeds
- **WHEN** new items exist only for feeds the caller does not subscribe to
- **THEN** the response SHALL contain no items
- **AND** `cursor` SHALL advance past them

#### Scenario: Invalid cursor
- **WHEN** `after` is negative or not a number
- **THEN** the server SHALL return `400`

#### Scenario: Successfully polled feed is covered
- **WHEN** the caller subscribes to a feed whose last poll returned `304` with no failures and whose next poll is in the future
- **THEN** the final page SHALL list that feed ID in `covered` with its poll times

#### Scenario: Failing or stalled feed is not covered
- **WHEN** a subscribed feed's last poll failed, was deferred, returned `410`, has never been polled, or is more than 60 minutes overdue
- **THEN** `covered` SHALL NOT list that feed ID

## ADDED Requirements

### Requirement: Browsers defer automatic refreshes to server polling

The client SHALL record the `covered` list from the latest successful items pull, without persisting it across page loads, and treat a feed as covered while that list is less than 45 minutes old. Automatic refreshes SHALL NOT fetch a covered feed that has been fetched before. Manual refreshes and first fetches of new feeds SHALL fetch regardless of coverage.

#### Scenario: Covered feed becomes due
- **WHEN** a previously fetched feed reaches its automatic refresh time
- **AND** the latest items pull, received 10 minutes ago, lists it as covered
- **THEN** the scheduler SHALL NOT request `/feed` for it

#### Scenario: Coverage lapses
- **WHEN** no items pull has succeeded for more than 45 minutes
- **THEN** the scheduler SHALL refresh due feeds as if no coverage had been reported

#### Scenario: Feed not covered
- **WHEN** a due feed is absent from the latest `covered` list
- **THEN** the scheduler SHALL refresh it automatically as before

#### Scenario: Manual refresh of a covered feed
- **WHEN** the user refreshes a covered feed manually
- **THEN** the client SHALL fetch it through `/feed`

#### Scenario: Server without item sync
- **WHEN** `/sync/capabilities` does not report `items: true`
- **THEN** no feed SHALL be treated as covered

### Requirement: Covered feeds record server poll times

When coverage arrives, the client SHALL set a covered, previously fetched feed's last-fetched and source-fetched times to `polled_at` when that is later than its last-fetched time, and its next-check time to `next_poll_at`. It SHALL NOT change the feed's validators or learned interval.

#### Scenario: Feed editor after server polls
- **WHEN** the server polled a covered feed 5 minutes ago and the browser last fetched it 2 hours ago
- **THEN** the feed SHALL report it was updated 5 minutes ago

#### Scenario: Never-fetched feed listed as covered
- **WHEN** a feed with no local fetch appears in `covered`
- **THEN** its last-fetched time SHALL remain unset so that its first fetch still runs

### Requirement: Scheduled sync pulls while active

While the page is visible and the user is not idle, each scheduler tick SHALL run a sync pull if the last successful pull was at least 15 minutes earlier, and SHALL complete it before choosing which feeds to refresh. Devices without a sync key SHALL make no sync request.

#### Scenario: Long-open active window
- **WHEN** a synced window stays visible and in use for an hour
- **THEN** the client SHALL pull at least every 15 minutes and insert server-polled items without fetching covered feeds

#### Scenario: Local-only device
- **WHEN** no sync key is stored
- **THEN** scheduler ticks SHALL NOT request any `/sync/` route
