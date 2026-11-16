## ADDED Requirements

### Requirement: Migrate confirmed permanent feed redirects

When two independent polls of a feed URL follow 301 or 308 responses to the same validated final URL, the server SHALL update live synced subscriptions that still reference the old URL, preserving their feed IDs and using the normal server timestamp for the URL field. It SHALL migrate the poll registry and retained items to the new URL without duplicating items. Cache hits SHALL NOT count as independent observations. Temporary redirects SHALL NOT change subscriptions.

#### Scenario: A permanent destination is confirmed
- **WHEN** two independent polls of one URL confirm the same 301 or 308 destination
- **THEN** all live synced subscriptions still using the old URL SHALL be updated
- **AND** the polling registry and retained items SHALL use the destination URL

#### Scenario: User changes a URL before redirect confirmation
- **WHEN** a subscription no longer references the old URL by the time the second redirect is confirmed
- **THEN** the server SHALL leave that subscription unchanged

### Requirement: Stop polling feeds removed with HTTP 410

When a poll receives HTTP 410 from the upstream feed, it SHALL record the status and stop scheduling that URL for automatic polling. Daily registry maintenance SHALL NOT reactivate an existing URL marked removed.

#### Scenario: Poll receives 410
- **WHEN** an upstream feed returns HTTP 410
- **THEN** the poller SHALL record status 410
- **AND** SHALL NOT automatically request that URL again

#### Scenario: Maintenance sees a removed feed
- **WHEN** a live subscription still references a URL previously marked 410
- **THEN** maintenance SHALL leave the URL stopped
