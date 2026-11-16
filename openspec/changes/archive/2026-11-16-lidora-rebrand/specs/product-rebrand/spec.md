## ADDED Requirements

### Requirement: Consistent Lidora identity
The product SHALL use Lidora display branding, lidora machine identity and https://lidora.app as its hosted canonical origin across maintained UI, public metadata, MCP, package and distribution surfaces. Custom headers SHALL use X-Lidora-* exclusively. Self-hosting SHALL use LIDORA_DATA_DIR with existing database filenames. The final application SHALL NOT support old-name aliases, dual writes or fallback configuration.

#### Scenario: A current client connects
- **WHEN** a client opens the app or connects through MCP
- **THEN** all product identity and hosted discovery metadata SHALL identify Lidora
- **AND** all custom branded protocol headers SHALL use the new prefix

### Requirement: Existing data moves forward
Migration SHALL preserve every browser store, unsynced state, server accounts and migration ledgers. Existing origins SHALL retain their database names; new-origin transfer SHALL use a guided handoff; manual backup SHALL be recovery only. Import SHALL validate and commit atomically before sync starts. Retries SHALL be safe and existing destination data SHALL be reconciled without loss.

#### Scenario: Local-only user moves origin
- **WHEN** a user chooses Move to Lidora from the previous origin
- **THEN** subscriptions, articles, bodies, flags, preferences, statistics and pending state SHALL be preserved

#### Scenario: Transfer fails
- **WHEN** validation or import fails
- **THEN** the source SHALL remain available and the destination SHALL NOT contain a partially committed library

#### Scenario: Source contains state for a deleted article
- **WHEN** the source has a body, flag or read marker whose article no longer exists
- **THEN** the transfer SHALL omit that unreferenced state and continue validating the remaining library
- **AND** the source library SHALL remain unchanged unless the verified transfer completes

### Requirement: Finite coordinated migration
Migration tooling SHALL have explicit removal criteria. The old origin SHALL remain migration-capable for returning and offline users until transfer is complete or a durable recovery route exists. Cutover SHALL coordinate automatic builds, server writes, scheduled jobs and recovery so that both domains use the same authoritative server data and one polling scheduler. MCP connections SHALL be reauthorized for the new origin without accepting old audiences as aliases.

#### Scenario: Cutover is accepted
- **WHEN** data transfer and new-origin operation are verified and remaining users cannot be stranded by retirement
- **THEN** migration-specific code SHALL be retired only when it is no longer needed for recovery
- **AND** public application identity SHALL use Lidora while documented internal storage names remain

### Requirement: Historical evidence is preserved
Archived specifications, Git history, prior releases and applied SQL migrations SHALL retain their historical integrity. Current guidance and specifications SHALL use Lidora terminology. Residual old names SHALL be limited to documented storage/infrastructure identifiers, required migration access and history.

#### Scenario: Final inventory is reviewed
- **WHEN** the rebrand is complete
- **THEN** no public branding or current protocol identity SHALL retain the previous brand; retained internal identifiers SHALL be documented

#### Scenario: Returning user migrates after launch
- **WHEN** an existing user opens the previous origin or installed PWA after the initial rollout
- **THEN** guided migration SHALL remain available without requiring manual backup as the normal path
- **AND** the user SHALL retain their library if the transfer is interrupted

### Requirement: Persistent server storage stays in place
The rebrand SHALL retain existing Worker and D1 identities, SQLite filenames, persistent directories and volume mounts. Both hosted domains SHALL share the existing backend. No database copy or storage rename SHALL be required solely for branding. New hosted browser libraries SHALL use lidora; established origins SHALL retain their existing database name.

#### Scenario: Self-hosted installation upgrades
- **WHEN** an operator updates the image and configures LIDORA_DATA_DIR to the existing directory
- **THEN** the server SHALL reuse existing database files and migration ledgers without moving data

#### Scenario: Domain cutover is gated
- **WHEN** browser transfer has not passed acceptance checks
- **THEN** lidora.app SHALL NOT become the advertised primary origin
