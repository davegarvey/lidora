# Spec Delta

## MODIFIED Requirements

### Requirement: Version 10 is the schema baseline

`DB_VERSION` SHALL be 12. The upgrade handler SHALL create the version 12 layout directly for a new database, migrate a version 11 database in place by adding the `items.by-feed-created` index, migrate a version 10 database by adding the `items.by-last-seen` and `items.by-feed-created` indexes and stamping existing items with the migration time, and retain the version 9 body-splitting path while stamping its items and adding both indexes. It SHALL delete every object store and recreate the version 12 layout, empty, for a database older than version 9. The handler SHALL NOT contain upgrade steps for versions 2 to 8, and code outside the upgrade handler SHALL read only the current layout.

#### Scenario: New database
- **WHEN** a new database is opened
- **THEN** it SHALL be created at version 12 with the stores `feeds`, `items`, `itemBodies`, `itemFlags`, `meta`, `feedStats` and `readMarkers`
- **AND** `items` SHALL have `by-last-seen` and compound `by-feed-created` indexes

#### Scenario: Version 9 database
- **WHEN** a version 9 database is opened
- **THEN** it SHALL be upgraded to version 12 with an empty `itemBodies` store and no `html` or `extractedHtml` on any article record
- **AND** every item SHALL receive `lastSeenAt`
- **AND** `items` SHALL have `by-last-seen` and compound `by-feed-created` indexes
- **AND** article flags, read markers, feed statistics and settings SHALL be unchanged

#### Scenario: Version 10 database
- **WHEN** a version 10 database is opened
- **THEN** its existing stores and records SHALL remain
- **AND** each existing item SHALL receive `lastSeenAt`
- **AND** `items` SHALL have `by-last-seen` and compound `by-feed-created` indexes

#### Scenario: Version 11 database
- **WHEN** a version 11 database is opened
- **THEN** its existing stores and item records SHALL remain unchanged
- **AND** `items` SHALL gain a compound `by-feed-created` index on `feedId` and `createdAt`

#### Scenario: Database older than version 9
- **WHEN** a database at any version from 1 to 8 is opened
- **THEN** every object store SHALL be deleted and the version 12 layout SHALL be created empty
