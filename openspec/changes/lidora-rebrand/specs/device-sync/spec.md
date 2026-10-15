## MODIFIED Requirements

### Requirement: Sync runs on Workers or configured self-hosted storage
Cloudflare Workers SHALL enable sync when a D1 binding is present. Node and Bun SHALL enable sync only when `LIDORA_DATA_DIR` is configured and local SQLite migrations have completed. Without either backend, sync routes SHALL NOT be registered and `/sync/capabilities` SHALL return 404.

#### Scenario: Self-hosted server has a data directory
- **WHEN** Node or Bun starts with a configured `LIDORA_DATA_DIR`
- **THEN** it SHALL apply the local sync migrations
- **AND** `GET /sync/capabilities` SHALL return 200 with `{ sync: true }`

#### Scenario: Self-hosted server has no data directory
- **WHEN** Node or Bun starts without `LIDORA_DATA_DIR`
- **THEN** sync routes SHALL NOT be registered
- **AND** `GET /sync/capabilities` SHALL return 404

#### Scenario: Workers adapter has D1 binding
- **WHEN** the server is started with a D1 binding
- **THEN** the sync routes SHALL be registered
- **AND** `GET /sync/capabilities` SHALL return 200 with `{ sync: true }`

