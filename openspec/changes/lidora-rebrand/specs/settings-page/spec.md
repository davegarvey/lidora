## ADDED Requirements

### Requirement: Rebrand preserves routed Settings navigation

Lidora SHALL retain Settings as the routed `/settings` view with the Devices, Agents and Server data sections, section deep links, responsive section navigation, and the established browser history and focus behavior.

#### Scenario: Open a Settings section directly
- **WHEN** the user opens or reloads `/settings/storage`
- **THEN** Lidora SHALL show the Storage section in the routed Settings page
- **AND** Back and responsive section navigation SHALL continue to follow the established Settings behavior

### Requirement: Rebrand keeps Settings flows inline

Pairing and import flows SHALL remain inline within their Settings sections. Rebranding SHALL NOT restore the removed Settings drawer or Agents modal.

#### Scenario: Complete an inline device flow
- **WHEN** the user pairs a device or imports subscriptions from Settings
- **THEN** the flow SHALL remain inline in the relevant section
- **AND** the rebrand SHALL NOT introduce a stacked modal

### Requirement: Rebrand keeps the Settings confirmation model

Preference changes SHALL remain immediate. Destructive and account-wide actions SHALL retain accessible confirmation dialogs.

#### Scenario: Confirm a destructive action
- **WHEN** the user deletes server data or revokes an agent
- **THEN** Lidora SHALL retain the accessible confirmation behavior before applying the action

### Requirement: Migration guidance uses inline Settings feedback

Migration and reconnection guidance SHALL use inline status and error feedback within the existing Settings sections.

#### Scenario: Move a library
- **WHEN** the user starts the hosted-origin transfer from Settings → Storage
- **THEN** progress, errors and retry guidance SHALL be reported accessibly
- **AND** the source library SHALL remain available until the destination has passed verification
