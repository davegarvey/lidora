## MODIFIED Requirements

### Requirement: Cache successful feed representations by complete URL

The `/feed` proxy SHALL cache successful feed representations using the complete upstream URL as the cache identity. Meaningful query parameters SHALL be preserved; the cache key SHALL NOT collapse distinct URLs into one representation.

The cache SHALL store the response body and its upstream `ETag` and `Last-Modified` validators. An upstream `Set-Cookie` or `Vary: *` header SHALL NOT prevent caching, because the proxy sends no client credentials and never returns upstream cookies. Representations larger than 8 MiB SHALL NOT be cached. A process-local memory cache SHALL hold at most 256 representations and at most 32 MiB of response bodies in total, evicting the least recently used representations first.

A representation SHALL be fresh from the most recent upstream `200` response or successful upstream `304` revalidation for its freshness lifetime, as defined by the upstream freshness hints requirement. Serving a cache hit SHALL NOT extend freshness. The cache SHALL retain a representation for 24 hours after it stops being fresh so that it can be served during transient upstream failures.

#### Scenario: Fresh cache hit avoids an upstream request

- **WHEN** a feed URL has a fresh cached successful representation
- **THEN** `/feed` SHALL return that representation without requesting the upstream URL
- **AND** the response SHALL preserve the cached `ETag` and `Last-Modified` values

#### Scenario: Cookie-setting feed is cached

- **WHEN** an upstream returns a successful feed response that includes `Set-Cookie`
- **THEN** the proxy SHALL cache the representation
- **AND** a later request within its freshness lifetime SHALL not contact the upstream
- **AND** the upstream cookie SHALL not be returned to the client

#### Scenario: Distinct query URLs do not share representations

- **WHEN** two feed requests differ in any URL component that is sent upstream, including query parameters
- **THEN** each URL SHALL use an independent cache entry
- **AND** a response cached for one URL SHALL never be returned for the other URL

#### Scenario: Cache expiry is absolute from upstream activity

- **WHEN** a cached representation is served repeatedly before its freshness ends
- **THEN** each cache hit SHALL retain the original freshness time
- **AND** repeated hits SHALL not create a sliding cache window

#### Scenario: Memory cache is bounded by total size

- **WHEN** storing a representation would take the process-local memory cache over 32 MiB of response bodies
- **THEN** the cache SHALL evict the least recently used representations until it is within the bound
- **AND** a later request for an evicted URL SHALL be treated as a cache miss
