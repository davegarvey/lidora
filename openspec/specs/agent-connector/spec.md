# agent-connector Specification

## Purpose
TBD - created by archiving change standardize-oauth-provider. Update Purpose after archive.

## Requirements

### Requirement: Shared library authorization server
Sift SHALL use Better Auth and its MCP, OAuth provider, JWT and CIMD plugins for authorization protocol processing on Cloudflare Workers with D1 and on Node and Bun with SQLite. Deployments SHALL use the same protocol implementation without a provider-selection environment variable. Only discovery, JWKS, authorization, registration, token and revocation protocol endpoints SHALL be publicly routed; provider account and session APIs SHALL remain internal.

#### Scenario: Deployment configuration
- **WHEN** OAuth is enabled on a supported deployment
- **THEN** a persistent `BETTER_AUTH_SECRET` of at least 32 characters is required, and `PUBLIC_URL`, when configured, defines the public origin
- **AND** missing secret configuration returns 503 for OAuth without disabling device sync

### Requirement: Convenient explicit approval
Sift SHALL preserve ten-minute single-use connection links and explicit consent across browsers. Each link SHALL have its own issuer `/oauth/c/<id>` and resource `/mcp/c/<id>`. The canonical issuer SHALL be `/oauth`. The library SHALL sign the authorization query before Sift accepts an approval request. A connection SHALL identify an account without exposing its sync key. Provider sessions SHALL remain server-side. Approval by a master key or approval code SHALL remain available when the link cannot identify an account automatically.

#### Scenario: Fresh browser
- **WHEN** a client starts authorization with an unused connection link in a browser without Sift data
- **THEN** the user can approve once without entering a key or code
- **AND** concurrent anonymous approvals cannot consume the same connection twice

#### Scenario: Explicit account fallback
- **WHEN** a connection has expired or been used and the authorization request is still valid
- **THEN** an authenticated account can approve explicitly
- **AND** a surviving connection record cannot be rebound to another account

### Requirement: Library credentials with immediate account control
The library SHALL issue authorization codes, JWT access tokens and rotating refresh tokens, and validate PKCE and client authentication. Codes SHALL expire after ten minutes and access tokens after one hour. Refresh tokens SHALL require `offline_access` and expire after at most one year; agent sessions SHALL expire after one year. Sift SHALL verify signatures, issuer, resource audience, expiry, granted scopes and the active account and grant for every authenticated request. Grant identities SHALL be isolated per approval. Settings revocation, account rotation and account deletion SHALL immediately invalidate both access and refresh credentials. The protocol revocation endpoint SHALL support refresh tokens. DPoP-bound access tokens SHALL not be advertised or accepted.

#### Scenario: Refresh replay
- **WHEN** a rotated refresh token is reused
- **THEN** the library invalidates its family
- **AND** Sift rejects outstanding access tokens for that grant without affecting other grants

#### Scenario: Resource isolation
- **WHEN** a JWT for a connection resource is sent to another MCP resource
- **THEN** the server rejects it
- **AND** no OAuth credential is accepted by master-key-only operations

### Requirement: Intentional migration and bounded metadata fetching
Migration SHALL remove the superseded custom OAuth tables and credentials and require existing OAuth clients to reconnect once. It SHALL preserve device sync, subscriptions, reading state and paired CLI credentials. Provider persistence SHALL use checked-in SQL migrations. Client metadata fetching SHALL require HTTPS, public destinations, no redirects, bounded response bodies and timeouts, and shared origin pacing. Node and Bun SHALL pin validated DNS addresses; Workers SHALL combine public-address validation with the platform public Internet fetch restriction.

#### Scenario: Existing installation upgrades
- **WHEN** the provider migration runs
- **THEN** old OAuth credentials stop authenticating and old protocol routes are removed
- **AND** existing paired CLI credentials and account data remain usable
