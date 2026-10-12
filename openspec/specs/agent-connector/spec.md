# agent-connector Specification

## Purpose
Define library-managed OAuth for Sift’s MCP connector across Cloudflare Workers and self-hosted deployments, preserving convenient explicit approval and immediate account control.

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
The library SHALL issue authorization codes, JWT access tokens and rotating refresh tokens, and validate PKCE and client authentication. Codes SHALL expire after ten minutes and access tokens after one hour. Every approved connection SHALL receive a refresh token: before the library processes an authorization request or client registration that includes `read` or `write` but not `offline_access`, Sift SHALL add `offline_access`. Refresh tokens SHALL expire 365 days after issuance and rotate on every use. Each successful refresh SHALL extend the agent session to the expiry of the new refresh token, so a connection ends only after 365 days without a refresh. Sift SHALL verify signatures, issuer, resource audience, expiry, granted scopes and the active account and grant for every authenticated request. Grant identities SHALL be isolated per approval. Settings revocation, account rotation and account deletion SHALL immediately invalidate both access and refresh credentials. A grant that is older than the authorization-code lifetime and has no unrevoked, unexpired refresh token SHALL stop authenticating and SHALL be omitted from agent listings, and scheduled cleanup SHALL remove it. The protocol revocation endpoint SHALL support refresh tokens. DPoP-bound access tokens SHALL not be advertised or accepted.

#### Scenario: Client requests only resource scopes
- **WHEN** a client authorises with the client metadata and the `read write` scope used by Codex or ChatGPT, without `offline_access`
- **THEN** the token response includes a refresh token and the scope `read write offline_access`
- **AND** after the access token expires, the client obtains new tokens with that refresh token without user interaction

#### Scenario: Dynamically registered client with explicit scopes
- **WHEN** a client registers with `scope` `read write` and then authorises with `read write`
- **THEN** registration and authorization succeed, and the token response includes a refresh token

#### Scenario: Regular use keeps the connection
- **WHEN** a connection refreshes 364 days after approval and again 364 days after that refresh
- **THEN** both refreshes succeed and the resulting access tokens authenticate

#### Scenario: Unused connection ends
- **WHEN** a connection has not refreshed for 365 days
- **THEN** its refresh token is rejected with `invalid_grant` and its access tokens no longer authenticate
- **AND** the connection is omitted from the agent listing and removed by scheduled cleanup

#### Scenario: Refresh replay
- **WHEN** a rotated refresh token is reused
- **THEN** the library invalidates its family
- **AND** Sift rejects outstanding access tokens for that grant without affecting other grants
- **AND** the grant is omitted from the agent listing

#### Scenario: Approval awaiting code exchange
- **WHEN** a grant was approved less than ten minutes ago and its authorization code has not yet been exchanged
- **THEN** the grant remains listed and is not removed by cleanup

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
