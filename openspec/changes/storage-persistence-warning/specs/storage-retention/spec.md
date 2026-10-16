## MODIFIED Requirements

### Requirement: Persistent storage and status
After a user's first feed subscription, the client SHALL request persistent browser storage once and SHALL record that it attempted the request. The Storage section of Settings SHALL show a one-line summary of the browser's storage usage and the number of article records, with sizes in KB, MB or GB as appropriate. Beneath the summary, without a disclosure, the section SHALL list the quota, number of article records and number of body records, and SHALL list the persistence state when persistence is granted or the browser does not report it. When persistence is not granted, the section SHALL instead show a single warning that persistent storage is off, explain what the browser may clear and what protects the library given the device's sync state, and offer a secondary action to ask the browser again. The warning SHALL NOT use the accent colour reserved for unread and selection. Missing or denied browser APIs SHALL not prevent reading or retention.

#### Scenario: Persistence is requested after first feed
- **WHEN** the first feed is added
- **THEN** the client SHALL request persistent storage and remember that it has requested it
- **AND** later feed additions SHALL not trigger another automatic request

#### Scenario: Warning without sync
- **WHEN** persistence is not granted, sync is off and the server supports sync
- **THEN** the warning SHALL suggest downloading a backup or adding a device to sync subscriptions and reading state
- **AND** the details list SHALL NOT repeat the persistence state

#### Scenario: Warning on a server without sync
- **WHEN** persistence is not granted and the server does not support sync
- **THEN** the warning SHALL suggest downloading a backup and SHALL NOT mention adding a device

#### Scenario: Warning with sync on
- **WHEN** persistence is not granted and sync is on
- **THEN** the warning SHALL say that subscriptions and reading state are synced but articles are kept only on this device

#### Scenario: User retries persistence from Settings
- **WHEN** browser persistence is not granted and the user selects the request action
- **THEN** the client SHALL call the browser persistence API and refresh the displayed state

#### Scenario: Browser declines the request
- **WHEN** the user selects the request action and the browser does not grant persistence
- **THEN** the section SHALL say that the browser declined and that installing Lidora may help

#### Scenario: Persistence is granted
- **WHEN** the browser reports that persistence is granted
- **THEN** the section SHALL show no warning and the details list SHALL show the persistence state as On

#### Scenario: Storage estimate is unavailable
- **WHEN** the browser does not support an estimate or persistence API
- **THEN** Settings SHALL show that value as unavailable
- **AND** feed reading and retention SHALL continue

#### Scenario: Large quota
- **WHEN** the browser reports a quota of 13,218,000,000 bytes
- **THEN** the quota SHALL be shown in GB, not MB
