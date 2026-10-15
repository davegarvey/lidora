## ADDED Requirements

### Requirement: Rebrand preserves the routed Settings experience

Lidora SHALL retain Settings as the routed `/settings` view, including section deep links, responsive navigation, browser history and focus behavior, inline pairing and import flows, and the Devices, Agents and Server data sections. Rebranding SHALL NOT restore the removed Settings drawer or Agents modal. Preference changes SHALL remain immediate; destructive and account-wide actions SHALL retain accessible confirmation dialogs. New migration and reconnection guidance SHALL use inline status and error feedback within the existing Settings sections.

#### Scenario: Open a Settings section directly
- **WHEN** the user opens or reloads `/settings/storage`
- **THEN** Lidora SHALL show the Storage section in the routed Settings page
- **AND** Back and responsive section navigation SHALL continue to follow the established Settings behavior

#### Scenario: Complete an inline device flow
- **WHEN** the user pairs a device or imports subscriptions from Settings
- **THEN** the flow SHALL remain inline in the relevant section
- **AND** the rebrand SHALL NOT introduce a stacked modal

#### Scenario: Confirm a destructive action
- **WHEN** the user deletes server data or revokes an agent
- **THEN** Lidora SHALL retain the accessible confirmation behavior before applying the action

#### Scenario: Move a library
- **WHEN** the user starts the hosted-origin transfer from Settings → Storage
- **THEN** progress, errors and retry guidance SHALL be reported accessibly
- **AND** the source library SHALL remain available until the destination has passed verification
