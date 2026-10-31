## ADDED Requirements

### Requirement: Unchanged feed bodies are not reparsed
After storing the items from a `200` poll response, the poller SHALL record a SHA-256 hash of the response body for that URL. When a later `200` response body has the same hash, the poller SHALL NOT parse it or write items, SHALL record the response's validators, and SHALL count the poll as unchanged. A body that fails to parse SHALL NOT replace the recorded hash.

#### Scenario: Feed without validators is unchanged
- **WHEN** a feed without `ETag` or `Last-Modified` returns the same body as its previous successful poll
- **THEN** the poll SHALL NOT parse the body or write items
- **AND** the URL SHALL be due again in 30 minutes

#### Scenario: Feed body changes
- **WHEN** a feed returns a body whose hash differs from the recorded hash
- **THEN** the poll SHALL parse the body, store new items and record the new hash
