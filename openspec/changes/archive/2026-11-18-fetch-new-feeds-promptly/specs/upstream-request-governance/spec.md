## MODIFIED Requirements

### Requirement: Stagger automatic refreshes

The scheduler SHALL distribute automatic feed refreshes over time using a stable per-feed jitter. Jitter SHALL NOT cause a feed to be refreshed before its learned interval has elapsed. Startup recovery SHALL not begin every due feed at the same instant. A feed that has never been fetched and has no pending retry SHALL be due immediately, without jitter.

#### Scenario: Several feeds become due together

- **WHEN** multiple feeds reach their learned refresh time together
- **THEN** their automatic requests SHALL be spread across the configured jitter window
- **AND** each feed SHALL remain no earlier than its learned interval

#### Scenario: Feed never fetched

- **WHEN** the scheduler evaluates a feed with no last-fetched time and no pending retry
- **THEN** the feed SHALL be due at once, regardless of its jitter
