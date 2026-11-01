# Spec Delta

## MODIFIED Requirements

### Requirement: Age-based local retention

Each stored article SHALL record when it was most recently included in a successful feed parse or sync item pull. Existing articles SHALL be stamped at migration time. After each refresh sweep, the client SHALL scan no more than 500 items for each cleanup pass and SHALL retain a continuation key so successive sweeps progress through eligible items. The client SHALL delete body records for unstarred items unseen for at least 90 days, and SHALL delete item records for unstarred unread items unseen for at least 365 days. It SHALL keep read and starred item records. Deleting an unread item SHALL also delete its body, flag and read marker. Lifetime feed statistics SHALL remain unchanged.

#### Scenario: Old body expires but article history remains
- **WHEN** an unstarred article has not appeared in a successful feed parse or sync pull for 90 days
- **THEN** its body record SHALL be deleted
- **AND** its article record and read/star flags SHALL remain

#### Scenario: Starred article is retained
- **WHEN** an article is starred, regardless of age or read state
- **THEN** its body and article record SHALL be retained

#### Scenario: Old unread article is removed
- **WHEN** an unstarred unread article has not appeared in a successful feed parse or sync pull for 365 days
- **THEN** its item, body, flag and read marker SHALL be deleted
- **AND** lifetime aggregate statistics SHALL remain unchanged

#### Scenario: Recent feed or sync item refreshes its age
- **WHEN** an item is included in a successful feed parse or sync item pull
- **THEN** `lastSeenAt` SHALL be updated even when the device already has that item

#### Scenario: Existing library receives a safe migration timestamp
- **WHEN** a version 10 database is upgraded to version 12
- **THEN** all existing items SHALL receive the migration time as `lastSeenAt`
- **AND** feeds, items, flags, markers, statistics, settings and body records SHALL remain present
