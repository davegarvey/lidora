## MODIFIED Requirements

### Requirement: Feed editor shows refresh status

The client SHALL store, locally and without syncing, when the server last received each feed from its source (derived from `Age`) and, when the server reports `X-Lidora-Retry-After`, when it will next contact the source. The feed editor SHALL show a single line with the time since the feed was received and, when the next check is in the future, its local time. No additional sidebar indicator SHALL be added.

#### Scenario: Feed served from a retained copy

- **WHEN** a refresh returns a stale representation with `Age: 2400` and `X-Lidora-Retry-After: 900`
- **THEN** the feed editor SHALL show that the feed was updated 40 minutes ago and when it will next be checked

#### Scenario: Sync does not transfer refresh status

- **WHEN** a sync pull merges a feed
- **THEN** its local refresh status SHALL be preserved
- **AND** it SHALL not be sent to the sync service
