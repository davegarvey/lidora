## ADDED Requirements

### Requirement: Schema initialisation runs once per database per process
Each runtime schema check against a D1 database SHALL run at most once per database binding per process or isolate, independently of how many requests or app instances use it. A failed check SHALL be retried by the next caller.

#### Scenario: Repeated sync requests
- **WHEN** a Worker isolate serves several `/sync/*`, `/oauth/*` or `/mcp` requests
- **THEN** the sync schema statements SHALL run for the first request only

#### Scenario: Schema check fails
- **WHEN** the schema check fails for one request
- **THEN** the next request SHALL run it again
