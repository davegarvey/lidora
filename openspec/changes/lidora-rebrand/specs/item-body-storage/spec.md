## MODIFIED Requirements

### Requirement: Tabs release the database for upgrades
When a connection receives a `versionchange` request from a newer version, the `blocking` handler SHALL close the connection and reload the page. When an open request waits on connections in other tabs, the `blocked` handler SHALL change the river's loading message to ask the reader to close other Lidora tabs. The blocked message SHALL take precedence over the upgrade message, and the upgrade message SHALL replace it once the upgrade starts.

#### Scenario: A newer version needs this tab's connection
- **WHEN** another tab requests a newer database version while this tab holds an open connection
- **THEN** this tab SHALL close its connection and reload the page

#### Scenario: Upgrade is blocked by another tab
- **WHEN** the database open is blocked by connections in other tabs that have no `blocking` handler
- **THEN** the loading message SHALL ask the reader to close other Lidora tabs
- **AND** the message SHALL change to the upgrade message once the other tabs close and the upgrade starts, and to the normal loading message once the open completes

