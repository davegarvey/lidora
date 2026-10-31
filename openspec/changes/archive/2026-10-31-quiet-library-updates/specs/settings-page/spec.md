## ADDED Requirements

### Requirement: Automatic article arrivals preference
Appearance SHALL contain one immediately applied, locally persisted switch labelled `Automatically show new articles`, described as `Add articles to the list as they arrive. This may move articles you’re browsing.` It SHALL default off when absent, use existing accessible switch conventions and SHALL NOT sync between devices. The preference SHALL govern background presentation, not data ingestion, explicit refresh, scope/filter changes, initial hydration or empty-list filling.

#### Scenario: Existing installation has no preference
- **WHEN** settings are loaded without an automatic-arrival value
- **THEN** the switch SHALL be off and background presentation changes SHALL wait for Show

#### Scenario: Enable with pending updates
- **WHEN** the user enables automatic arrivals with held results
- **THEN** the preference SHALL persist on this device
- **AND** held results SHALL apply on the next list presentation with anchor preservation
- **AND** an open article SHALL NOT be interrupted

#### Scenario: Disable automatic arrivals
- **WHEN** the user disables the preference
- **THEN** the currently presented sequence SHALL become the held baseline
- **AND** subsequent background membership/order changes SHALL wait for Show

#### Scenario: Persistence fails
- **WHEN** the preference cannot be saved
- **THEN** Settings SHALL show an actionable inline failure
- **AND** SHALL NOT imply the preference was successfully persisted
