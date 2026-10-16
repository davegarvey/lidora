## MODIFIED Requirements

### Requirement: Pair link results

When the app starts with a `?pair=<code>` query, the system SHALL remove the query from the URL and show the outcome in the Devices section, not in a dialog. When this device has no sync key, the system SHALL redeem the code and pair. When this device already has a sync key, the system SHALL NOT redeem the code; it SHALL show the Devices section with the "Join a different sync instead" panel expanded, the code filled in and the warning that joining leaves the current sync, so that switching syncs needs the user to confirm with Pair.

#### Scenario: Pair link succeeds
- **WHEN** a device without a sync key opens a pair link and the code is redeemed successfully
- **THEN** Settings SHALL show the Devices section with the status "This device is now syncing"

#### Scenario: Pair link fails
- **WHEN** a device without a sync key opens a pair link and the code cannot be redeemed
- **THEN** Settings SHALL show the Devices section with the join card expanded, the code filled in and the error shown

#### Scenario: Pair link while already syncing
- **WHEN** a device that has a sync key opens a pair link
- **THEN** the code SHALL NOT be redeemed and the sync key SHALL NOT change
- **AND** Settings SHALL show the Devices section with the "Join a different sync instead" panel expanded, the code filled in and the warning that joining leaves the current sync
- **AND** only when the user activates Pair SHALL the code be redeemed and the device switch syncs

#### Scenario: Pair link when the startup sync fails
- **WHEN** a device opens a pair link and its startup sync fails, for example because the server rejects its key
- **THEN** the pair link SHALL still be handled as above
