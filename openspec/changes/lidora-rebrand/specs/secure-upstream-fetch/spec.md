## RENAMED Requirements

- FROM: `### Requirement: Accept proxy requests only from Sift's own origin`
- TO: `### Requirement: Accept proxy requests only from Lidora's own origin`

## MODIFIED Requirements

### Requirement: Accept proxy requests only from Lidora's own origin

The `/feed`, `/article` and `/img` endpoints SHALL reject a request whose `Sec-Fetch-Site` header is present and is neither `same-origin` nor `none`, with status `403`, before validating the target or contacting any upstream. A request without the header SHALL NOT be rejected on this basis. The rejection SHALL carry the endpoint's isolation headers, `Cache-Control: no-store` and `X-Lidora-Request-Source: same-site-check`.

#### Scenario: Cross-site request is rejected

- **WHEN** a request to a proxy endpoint carries `Sec-Fetch-Site: cross-site`
- **THEN** the proxy SHALL return `403` with the endpoint's isolation headers
- **AND** no upstream request SHALL be made

#### Scenario: Same-site request from another origin is rejected

- **WHEN** a request to a proxy endpoint carries `Sec-Fetch-Site: same-site`
- **THEN** the proxy SHALL return `403`

#### Scenario: Application and address-bar requests are accepted

- **WHEN** a request to a proxy endpoint carries `Sec-Fetch-Site: same-origin` or `none`
- **THEN** the request SHALL proceed to the per-client limit and the normal proxy flow

#### Scenario: Non-browser client has no Sec-Fetch-Site header

- **WHEN** a request to a proxy endpoint carries no `Sec-Fetch-Site` header
- **THEN** the request SHALL NOT be rejected by the same-site check
- **AND** it SHALL remain subject to the per-client limit


### Requirement: Limit proxy requests per client

The `/feed`, `/article` and `/img` endpoints SHALL limit requests per client IP address in fixed 60-second windows. `/feed` and `/article` SHALL share one budget of 2000 requests per window, and `/img` SHALL have a separate budget of 600 requests per window. A request over its budget SHALL receive `429` with `Retry-After`, `Cache-Control: no-store`, `X-Lidora-Request-Source: client-limit` and the endpoint's isolation headers. Responses served from the shared feed cache SHALL count towards the budget. The limit SHALL be applied after the same-site check and before target validation, origin governance, cache lookup or any upstream request.

On Cloudflare Workers the limit SHALL be enforced by Cloudflare's Workers rate limiting binding when it is configured, keyed by the `CF-Connecting-IP` address, without writing to D1. On Node and Bun, and on Workers without the binding, the limit SHALL be enforced by a bounded process-local limiter with the same budgets. If the binding call fails, the process-local limiter SHALL decide instead and the request SHALL NOT fail because of it.

On Node and Bun the client address SHALL be the connection's socket address. `X-Forwarded-For` SHALL be ignored unless an explicit trusted-proxy setting enables it, in which case only the entry added by the configured number of trusted proxies SHALL be used. IPv6 addresses SHALL be keyed by their /64 prefix.

#### Scenario: Client exceeds its budget

- **WHEN** one client address makes more requests to `/feed` and `/article` than its budget within a window
- **THEN** the excess requests SHALL receive `429` with `Retry-After` and the endpoint's isolation headers
- **AND** no target validation or upstream request SHALL be made for them

#### Scenario: Budget recovers

- **WHEN** a limited client waits for the `Retry-After` interval
- **THEN** its next request SHALL be accepted

#### Scenario: Image and feed budgets are separate

- **WHEN** a client has exhausted its `/img` budget
- **THEN** its `/feed` and `/article` requests SHALL still be accepted

#### Scenario: Clients are limited independently

- **WHEN** one client address is limited
- **THEN** requests from other client addresses SHALL be unaffected

#### Scenario: Binding is absent

- **WHEN** the rate limiting binding is not configured, as in local development and tests
- **THEN** the process-local limiter SHALL enforce the same budgets
- **AND** the proxy SHALL otherwise behave normally

#### Scenario: Forwarded address is not trusted by default

- **WHEN** a request to a Node or Bun server carries `X-Forwarded-For` and no trusted-proxy setting is enabled
- **THEN** the limit SHALL be keyed by the socket address

#### Scenario: Limit rejection is privacy-safe

- **WHEN** a request is rejected by the same-site check or the per-client limit
- **THEN** the server MAY record a diagnostic containing only the route, status, reason and source
- **AND** the diagnostic SHALL NOT contain the client address or the requested URL


### Requirement: Isolate proxied responses from the application origin

Every response from the `/feed`, `/article` and `/img` proxy endpoints, including `304`, upstream error and locally generated error responses, SHALL include `X-Content-Type-Options: nosniff` and a `Content-Security-Policy` containing the `sandbox` directive without `allow-scripts` or `allow-same-origin`. `/feed` and `/article` responses SHALL also include `default-src 'none'`. A proxied response opened directly in a browser SHALL NOT run script or gain access to Lidora's origin storage.

#### Scenario: Proxied article opened directly is sandboxed

- **WHEN** a browser navigates to `/article?url=` for a page containing script
- **THEN** the response SHALL carry `Content-Security-Policy: default-src 'none'; sandbox`
- **AND** the document SHALL have an opaque origin with no access to Lidora's IndexedDB or localStorage

#### Scenario: Proxied feed is sandboxed

- **WHEN** `/feed?url=` returns a successful or not-modified response
- **THEN** the response SHALL carry `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`

#### Scenario: Proxied image is sandboxed

- **WHEN** `/img?url=` returns an image
- **THEN** the response SHALL carry `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`
- **AND** the image SHALL still render in an `<img>` element in the application

#### Scenario: Local failure is sandboxed

- **WHEN** a proxy request is rejected before any upstream request, such as for an invalid `url` parameter
- **THEN** the error response SHALL carry the endpoint's isolation headers


### Requirement: Do not forward upstream headers on proxy errors

When an upstream returns a non-2xx status other than `304`, the proxy SHALL return that status with `Content-Type: text/plain; charset=utf-8` and `Cache-Control: no-store`. It SHALL forward only `Retry-After`, `X-Lidora-Retry-After`, `X-Lidora-Request-Source` and `X-Lidora-Cache`, and SHALL NOT forward any other upstream header, including `Content-Type` and `Set-Cookie`.

#### Scenario: Upstream HTML error is returned as plain text

- **WHEN** an upstream returns `404` with `Content-Type: text/html` and a `Set-Cookie` header
- **THEN** the proxy response SHALL have status `404` and `Content-Type: text/plain; charset=utf-8`
- **AND** the response SHALL NOT contain `Set-Cookie`

#### Scenario: Retry guidance is preserved

- **WHEN** an upstream error carries `Retry-After`
- **THEN** the proxy response SHALL include the same `Retry-After` value

