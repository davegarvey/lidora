## MODIFIED Requirements

### Requirement: Expose non-authoritative cache diagnostics

Successful `/feed` responses SHALL expose the cached representation age through the standard `Age` response header, measured from the last upstream `200` or successful `304`. The proxy MAY expose an `X-Lidora-Cache` diagnostic header describing whether the response was a cache hit, miss, revalidation or stale representation. A stale representation SHALL include `X-Lidora-Retry-After` with the whole seconds until the proxy will next contact the upstream. These headers SHALL not be required for browser refresh correctness.

#### Scenario: Cache hit reports representation age

- **WHEN** `/feed` returns a cached successful representation
- **THEN** the response SHALL include `Age` in whole seconds since the last upstream fetch or revalidation
- **AND** the browser SHALL remain able to process the response without interpreting `Age`

#### Scenario: Stale representation reports the next upstream attempt

- **WHEN** `/feed` returns a retained representation because the upstream is in cooldown
- **THEN** the response SHALL include `X-Lidora-Cache: stale`
- **AND** it SHALL include `X-Lidora-Retry-After` with the remaining cooldown in seconds

