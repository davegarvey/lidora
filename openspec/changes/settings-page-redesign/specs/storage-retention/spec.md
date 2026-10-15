## MODIFIED Requirements

### Requirement: Persistent storage and status
After a user's first feed subscription, the client SHALL request persistent browser storage once and SHALL record that it attempted the request. The Storage section of Settings SHALL show a one-line summary of the browser's storage usage and the number of article records, with sizes in KB, MB or GB as appropriate. Beneath the summary, without a disclosure, the section SHALL list the quota, persistence state, number of article records and number of body records. When persistence is not granted, the section SHALL explain that the browser may clear Sift's data when space runs low and SHALL offer an action to request persistence again. Missing or denied browser APIs SHALL not prevent reading or retention.

#### Scenario: Persistence is requested after first feed
- **WHEN** the first feed is added
- **THEN** the client SHALL request persistent storage and remember that it has requested it
- **AND** later feed additions SHALL not trigger another automatic request

#### Scenario: User retries persistence from Settings
- **WHEN** browser persistence is not granted and the user selects the request action
- **THEN** the client SHALL call the browser persistence API and refresh the displayed state

#### Scenario: Storage estimate is unavailable
- **WHEN** the browser does not support an estimate or persistence API
- **THEN** Settings SHALL show that value as unavailable
- **AND** feed reading and retention SHALL continue

#### Scenario: Large quota
- **WHEN** the browser reports a quota of 13,218,000,000 bytes
- **THEN** the quota SHALL be shown in GB, not MB
