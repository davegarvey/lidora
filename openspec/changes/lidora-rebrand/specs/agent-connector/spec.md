## MODIFIED Requirements

### Requirement: Shared library authorization server
Lidora SHALL use Better Auth and its MCP, OAuth provider, JWT and CIMD plugins for authorization protocol processing on Cloudflare Workers with D1 and on Node and Bun with SQLite. Deployments SHALL use the same protocol implementation without a provider-selection environment variable. Only discovery, JWKS, authorization, registration, token and revocation protocol endpoints SHALL be publicly routed; provider account and session APIs SHALL remain internal.

#### Scenario: Deployment configuration
- **WHEN** OAuth is enabled on a supported deployment
- **THEN** a persistent `BETTER_AUTH_SECRET` of at least 32 characters is required, and `PUBLIC_URL`, when configured, defines the public origin
- **AND** missing secret configuration returns 503 for OAuth without disabling device sync


### Requirement: Convenient explicit approval
Lidora SHALL preserve ten-minute single-use connection links and explicit consent across browsers. Each link SHALL have its own issuer `/oauth/c/<id>` and resource `/mcp/c/<id>`. The canonical issuer SHALL be `/oauth`. The library SHALL sign the authorization query before Lidora accepts an approval request. A connection SHALL identify an account without exposing its sync key. Provider sessions SHALL remain server-side. Approval by a master key or approval code SHALL remain available when the link cannot identify an account automatically.

#### Scenario: Fresh browser
- **WHEN** a client starts authorization with an unused connection link in a browser without Lidora data
- **THEN** the user can approve once without entering a key or code
- **AND** concurrent anonymous approvals cannot consume the same connection twice

#### Scenario: Explicit account fallback
- **WHEN** a connection has expired or been used and the authorization request is still valid
- **THEN** an authenticated account can approve explicitly
- **AND** a surviving connection record cannot be rebound to another account


### Requirement: Library credentials with immediate account control
The library SHALL issue authorization codes, JWT access tokens and rotating refresh tokens, and validate PKCE and client authentication. Codes SHALL expire after ten minutes and access tokens after one hour. Every approved connection SHALL receive a refresh token: before the library processes an authorization request or client registration that includes `read` or `write` but not `offline_access`, Lidora SHALL add `offline_access`. Refresh tokens SHALL expire 365 days after issuance and rotate on every use. Each successful refresh SHALL extend the agent session to the expiry of the new refresh token, so a connection ends only after 365 days without a refresh. Lidora SHALL verify signatures, issuer, resource audience, expiry, granted scopes and the active account and grant for every authenticated request. Grant identities SHALL be isolated per approval. Settings revocation, account rotation and account deletion SHALL immediately invalidate both access and refresh credentials. A grant that is older than the authorization-code lifetime and has no unrevoked, unexpired refresh token SHALL stop authenticating and SHALL be omitted from agent listings, and scheduled cleanup SHALL remove it. The protocol revocation endpoint SHALL support refresh tokens. DPoP-bound access tokens SHALL not be advertised or accepted.

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
- **AND** Lidora rejects outstanding access tokens for that grant without affecting other grants
- **AND** the grant is omitted from the agent listing

#### Scenario: Approval awaiting code exchange
- **WHEN** a grant was approved less than ten minutes ago and its authorization code has not yet been exchanged
- **THEN** the grant remains listed and is not removed by cleanup

#### Scenario: Resource isolation
- **WHEN** a JWT for a connection resource is sent to another MCP resource
- **THEN** the server rejects it
- **AND** no OAuth credential is accepted by master-key-only operations


### Requirement: Remote MCP endpoint

The system SHALL serve a stateless Model Context Protocol endpoint at `/mcp`, using the Streamable HTTP transport, on every server adapter with sync storage configured. Each `POST` SHALL receive its JSON-RPC response in the HTTP response. `GET /mcp` SHALL return HTTP 405. Write tools SHALL take effect without any Lidora browser tab open.

#### Scenario: Authenticated tool listing
- **WHEN** a client sends `tools/list` to `/mcp` with a valid bearer access token
- **THEN** the server SHALL return the tools permitted by the token's scopes, each with an input schema, output schema and annotations

#### Scenario: Unauthenticated request
- **WHEN** a client sends any request to `/mcp` without a valid bearer token
- **THEN** the server SHALL respond with HTTP 401
- **AND** SHALL include `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`

#### Scenario: No browser tab required
- **WHEN** an agent calls a write tool while no Lidora browser tab is open
- **THEN** the change SHALL be applied to the sync database
- **AND** every synced device SHALL receive it on its next pull


### Requirement: MCP server instructions

The `initialize` result SHALL include `instructions` that describe Lidora, its identifier conventions, and the recommended tool sequences for recommending feeds, discovering a site's feed, and summarising recent reading.

#### Scenario: Instructions guide discovery
- **WHEN** a client initialises a session
- **THEN** the instructions SHALL tell the agent to verify candidate feeds with `discover_feeds` before proposing or subscribing to them


### Requirement: Authorisation request validation

`GET /oauth/oauth2/authorize` SHALL require `response_type=code`, a known client, an exactly matching redirect URI (any port for loopback), an S256 `code_challenge`. The effective `resource` SHALL equal the issuer’s MCP resource; routing SHALL supply that resource when omitted. Scopes SHALL be a subset of `read write offline_access`. Client and redirect URI errors SHALL be shown on Lidora's page without redirecting. Other errors SHALL redirect with the OAuth error and `state`.

#### Scenario: Missing PKCE
- **WHEN** an authorisation request omits `code_challenge`
- **THEN** the server SHALL redirect with `error=invalid_request`

#### Scenario: Unregistered redirect URI
- **WHEN** an authorisation request names a redirect URI not registered for the client
- **THEN** the server SHALL show an error page and SHALL NOT redirect

#### Scenario: Valid request
- **WHEN** an authorisation request passes validation
- **THEN** the server SHALL store it as pending for ten minutes and serve the consent screen


### Requirement: Approval code fallback

When the consent request has no usable connection ID, the consent screen SHALL show an 8-character, single-use approval code with a copy action, and a QR code for scanning. Under Settings → Agents, the app SHALL accept a pasted, typed or scanned code. It SHALL show the client name, redirect host and scopes before approving. When this device has no sync key, looking up a code SHALL turn sync on first. The consent page SHALL poll and redirect once a decision is made.

#### Scenario: Approve by pasted code
- **WHEN** the user copies the code from the consent page, pastes it into the installed app, and approves
- **THEN** the consent page SHALL redirect to the client with an authorisation code bound to the app's sync key

#### Scenario: Expired approval code
- **WHEN** the user enters an approval code more than ten minutes after the request was created
- **THEN** the app SHALL report that the request has expired
- **AND** no grant SHALL be issued

#### Scenario: Sync not enabled
- **WHEN** the consent page has no connection ID and no sync key
- **THEN** the screen SHALL explain that approval requires Lidora with sync turned on, and SHALL show the approval code


### Requirement: Connect an agent screen

Settings SHALL have a dedicated Agents section with a Connect an agent action, a connected-agent list with inline rename and revocation confirmation, and secondary approval-code entry. When this device has no sync key, the section SHALL explain that connecting an agent turns on the server copy of subscriptions and reading progress. It SHALL show loading, empty and retryable error states. It SHALL NOT show sync keys, the plain `/mcp` address, machine-readable document links, or stack dialogs over Settings.

#### Scenario: Connect with sync off
- **WHEN** a user without a sync key starts agent setup
- **THEN** the app SHALL turn sync on before creating the connection
- **AND** if enabling sync fails, it SHALL report the error and leave sync off

#### Scenario: Approval code entry is secondary
- **WHEN** the user opens the section
- **THEN** the approval-code field SHALL be hidden until the user taps "Have an approval code?"

#### Scenario: Revoke a connected agent
- **WHEN** the user confirms revocation in the agent's row
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


### Requirement: Refresh token rotation

`POST /oauth/oauth2/token` SHALL support the `refresh_token` grant. Lidora SHALL grant `offline_access` to every approved connection. Refresh tokens SHALL expire 365 days after issuance and SHALL rotate on every use; each refresh SHALL extend the agent session to the new refresh token's expiry. Presenting an already-rotated refresh token SHALL revoke every token in that grant. `POST /oauth/oauth2/revoke` SHALL revoke a presented refresh token.

#### Scenario: Refresh
- **WHEN** a client presents a current refresh token
- **THEN** the server SHALL return a new access token and a new refresh token, and SHALL invalidate the old refresh token

#### Scenario: Occasional use keeps the connection
- **WHEN** an agent is unused for several months and then refreshes with its current refresh token
- **THEN** the server SHALL issue new tokens without user interaction

#### Scenario: Refresh token reuse
- **WHEN** a refresh token that has already been rotated is presented
- **THEN** the server SHALL respond `invalid_grant`
- **AND** SHALL revoke all access and refresh tokens of that grant


### Requirement: Client-neutral setup instructions

The setup instructions SHALL describe Lidora as a remote MCP server using the Streamable HTTP transport and OAuth, give the connection URL, ask the agent to add it as a server named "lidora" available across the user's projects and to start the sign-in, and ask agents that cannot change their own configuration to say where the user should add the URL. They SHALL NOT name particular clients or ask the agent to fetch anything.

#### Scenario: Agent with a shell
- **WHEN** the user pastes the instructions into a coding agent that can manage its MCP configuration
- **THEN** the instructions SHALL give it everything needed to add the server and start the OAuth sign-in

#### Scenario: Chat-only agent
- **WHEN** the user pastes the instructions into an agent that cannot change its configuration
- **THEN** the instructions SHALL ask it to tell the user where to add the URL


### Requirement: Consent page isolation

The consent page at `/connect` SHALL be a standalone page. It SHALL NOT start sync, register a sync key, refresh feeds or create IndexedDB databases, local storage entries or service worker registrations in a browser that holds no Lidora data.

#### Scenario: Fresh browser
- **WHEN** the consent page opens in a browser that has never run Lidora
- **THEN** the browser SHALL hold no Lidora IndexedDB database afterwards


### Requirement: Agent connection discovery document

The system SHALL serve `/llms.txt` as a static asset describing Lidora, the MCP endpoint, the OAuth metadata URLs, the OpenAPI document, the scopes, and the bearer header for HTTP use.

#### Scenario: Agent reads llms.txt
- **WHEN** an agent fetches `<origin>/llms.txt`
- **THEN** it SHALL find the MCP URL and how authorisation is obtained
