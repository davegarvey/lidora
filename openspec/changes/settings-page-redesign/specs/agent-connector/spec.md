## MODIFIED Requirements

### Requirement: Approval code fallback

When the consent request has no usable connection ID, the consent screen SHALL show an 8-character, single-use approval code with a copy action, and a QR code of it for the in-app scanner. Under Settings → Agents, the app SHALL accept a pasted, typed or scanned code. It SHALL show the client name, redirect host and scopes before approving. When this device has no sync key, looking up a code (which precedes approving) SHALL turn sync on first. The consent page SHALL poll and redirect once a decision is made.

#### Scenario: Approve by pasted code
- **WHEN** the user copies the code from the consent page, pastes it into the installed app, and approves
- **THEN** the consent page SHALL redirect to the client with an authorisation code bound to the app's sync key

#### Scenario: Expired approval code
- **WHEN** the user enters an approval code more than ten minutes after the request was created
- **THEN** the app SHALL report that the request has expired
- **AND** no grant SHALL be issued

#### Scenario: Sync not enabled
- **WHEN** the consent page has no connection ID and no sync key
- **THEN** the screen SHALL tell the user to open Settings → Agents in Sift and enter the code, and SHALL show the approval code

### Requirement: Connect an agent screen

Settings SHALL have an Agents section, separate from the Devices section, that shows only what connecting and managing agents needs:

- one sentence of explanation and a Connect an agent button (see Single-use connection URLs)
- when this device has no sync key, a note that agents use the copy of the subscriptions and reading progress stored on the Sift server and that connecting one turns this on
- a "Connected agents" heading followed by the connected agents (see Connected agent identity), each with inline rename and a Revoke that expands an inline confirmation within the agent's row
- a "Have an approval code?" link that reveals code entry with a QR scan option

It SHALL NOT mention sync keys, and SHALL NOT show the plain `/mcp` address or links to machine-readable documents.

The connected-agents list SHALL show a loading state while it loads, "No agents connected" when it is empty, and an error with a Retry action when it fails to load. It SHALL reload after an agent is revoked. A failed rename or revoke SHALL be reported next to the list.

#### Scenario: Connect with sync off
- **WHEN** a user without a sync key activates Connect an agent
- **THEN** the app SHALL turn sync on before minting the connection link
- **AND** if turning sync on fails, SHALL show the error next to the button and leave sync off

#### Scenario: Approval code entry is secondary
- **WHEN** the user opens the section
- **THEN** the approval-code field SHALL be hidden until the user taps "Have an approval code?"

#### Scenario: Revoke a connected agent
- **WHEN** the user activates Revoke on an OAuth grant and confirms in the agent's row
- **THEN** the grant's access and refresh tokens SHALL stop working immediately
- **AND** the agent SHALL no longer be listed

#### Scenario: Revoke fails
- **WHEN** the revoke request fails
- **THEN** the inline confirmation SHALL remain open with the error shown
- **AND** the agent SHALL remain listed

#### Scenario: No agents
- **WHEN** the list loads and no agents are connected
- **THEN** the section SHALL show "No agents connected"

#### Scenario: List fails to load
- **WHEN** the connected-agents request fails
- **THEN** the section SHALL show an error with a Retry action, not an empty list

#### Scenario: New connection appears
- **WHEN** an agent completes authorisation and the user reopens the Agents section
- **THEN** the agent SHALL appear in the connected-agents list under its client name

#### Scenario: Expired connection link
- **WHEN** a connection link has expired
- **THEN** the section SHALL state that the link has expired and offer Create a new link
