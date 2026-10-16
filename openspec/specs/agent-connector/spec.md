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
Migration SHALL remove the superseded custom OAuth tables and credentials and require existing OAuth clients to reconnect once. It SHALL preserve device sync, subscriptions and reading state. Provider persistence SHALL use checked-in SQL migrations. Client metadata fetching SHALL require HTTPS, public destinations, no redirects, bounded response bodies and timeouts, and shared origin pacing. Node and Bun SHALL pin validated DNS addresses; Workers SHALL combine public-address validation with the platform public Internet fetch restriction.

#### Scenario: Existing installation upgrades
- **WHEN** the provider migration runs
- **THEN** old OAuth credentials stop authenticating and old protocol routes are removed
- **AND** existing account data remains usable

### Requirement: Remote MCP endpoint

The system SHALL serve a stateless Model Context Protocol endpoint at `/mcp`, using the Streamable HTTP transport, on every server adapter with sync storage configured. Each `POST` SHALL receive its JSON-RPC response in the HTTP response. `GET /mcp` SHALL return HTTP 405. Write tools SHALL take effect without any Sift browser tab open.

#### Scenario: Authenticated tool listing
- **WHEN** a client sends `tools/list` to `/mcp` with a valid bearer access token
- **THEN** the server SHALL return the tools permitted by the token's scopes, each with an input schema, output schema and annotations

#### Scenario: Unauthenticated request
- **WHEN** a client sends any request to `/mcp` without a valid bearer token
- **THEN** the server SHALL respond with HTTP 401
- **AND** SHALL include `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`

#### Scenario: No browser tab required
- **WHEN** an agent calls a write tool while no Sift browser tab is open
- **THEN** the change SHALL be applied to the sync database
- **AND** every synced device SHALL receive it on its next pull

### Requirement: MCP server instructions

The `initialize` result SHALL include `instructions` that describe Sift, its identifier conventions, and the recommended tool sequences for recommending feeds, discovering a site's feed, and summarising recent reading.

#### Scenario: Instructions guide discovery
- **WHEN** a client initialises a session
- **THEN** the instructions SHALL tell the agent to verify candidate feeds with `discover_feeds` before proposing or subscribing to them

### Requirement: OAuth protected-resource metadata

The system SHALL serve RFC 9728 protected-resource metadata at `/.well-known/oauth-protected-resource` without authentication. It SHALL name the resource `<origin>/mcp`, the authorisation server `<origin>/oauth`, and the scopes `read` and `write`. When `PUBLIC_URL` is configured, it SHALL replace the request origin in every advertised URL.

#### Scenario: Discovery from a 401
- **WHEN** a client follows the `resource_metadata` URL from a 401
- **THEN** it SHALL find the resource identifier, the authorisation server and the supported scopes

### Requirement: OAuth authorisation-server metadata

The system SHALL serve RFC 8414 metadata at `/.well-known/oauth-authorization-server/oauth` without authentication. It SHALL advertise the authorisation, token, registration and revocation endpoints, `S256` as the only code challenge method, the `authorization_code` and `refresh_token` grants, `none` and library-supported authenticated methods including `private_key_jwt` as token endpoint authentication methods, and support for Client ID Metadata Documents.

#### Scenario: Complete discovery
- **WHEN** a client reads the authorisation-server metadata
- **THEN** it SHALL obtain every endpoint needed to complete authorisation without further configuration

### Requirement: Client ID Metadata Documents

The system SHALL accept a `client_id` that is an HTTPS URL by fetching it, through the upstream fetch policy, as a Client ID Metadata Document. The document's `client_id` field SHALL equal the URL, the document SHALL list the requested redirect URI, and the library SHALL enforce its declared client authentication method, including verification of signed assertions when `private_key_jwt` is selected.

#### Scenario: Client that prefers signed authentication
- **WHEN** a document declares `private_key_jwt` but lists `none` among its supported methods
- **THEN** the server SHALL accept the client as a public client

#### Scenario: Metadata document client
- **WHEN** an authorisation request uses an HTTPS `client_id` whose document lists the requested redirect URI
- **THEN** the server SHALL accept the client and use the document's `client_name` on the consent screen

#### Scenario: Metadata document mismatch
- **WHEN** the fetched document's `client_id` differs from the requested URL, or it does not list the redirect URI
- **THEN** the server SHALL refuse the request without redirecting to the supplied redirect URI

### Requirement: Dynamic client registration

The system SHALL provide RFC 7591 registration at `POST /oauth/oauth2/register`. It SHALL support public clients (`token_endpoint_auth_method` of `none`) and library-supported authenticated clients, SHALL require at least one redirect URI, and SHALL accept only HTTPS, loopback HTTP (`127.0.0.1`, `[::1]`, `localhost`) or private-use scheme (RFC 8252) redirect URIs. Fragments and executable schemes SHALL be refused. Registration SHALL be rate-limited per client IP.

#### Scenario: Dynamic registration
- **WHEN** a client registers with a name and redirect URIs
- **THEN** the server SHALL return a `client_id` and store the client as public

#### Scenario: Non-HTTPS redirect refused
- **WHEN** a client registers a plain HTTP redirect URI that is not loopback, a URI with a fragment, or a `javascript:`, `data:`, `file:`, `blob:`, `about:`, `vbscript:`, `ws:` or `wss:` URI
- **THEN** the server SHALL respond with `invalid_redirect_uri`

#### Scenario: Private-use scheme accepted
- **WHEN** a client registers `cursor://anysphere.cursor-retrieval/oauth/callback`
- **THEN** the server SHALL accept it, and the consent view SHALL mark the client unverified and show `cursor://` as the redirect host

### Requirement: Authorisation request validation

`GET /oauth/oauth2/authorize` SHALL require `response_type=code`, a known client, an exactly matching redirect URI (any port for loopback), an S256 `code_challenge`. The effective `resource` SHALL equal the issuer’s MCP resource; routing SHALL supply that resource when omitted. Scopes SHALL be a subset of `read write offline_access`. Client and redirect URI errors SHALL be shown on Sift's page without redirecting. Other errors SHALL redirect with the OAuth error and `state`.

#### Scenario: Missing PKCE
- **WHEN** an authorisation request omits `code_challenge`
- **THEN** the server SHALL redirect with `error=invalid_request`

#### Scenario: Unregistered redirect URI
- **WHEN** an authorisation request names a redirect URI not registered for the client
- **THEN** the server SHALL show an error page and SHALL NOT redirect

#### Scenario: Valid request
- **WHEN** an authorisation request passes validation
- **THEN** the server SHALL store it as pending for ten minutes and serve the consent screen

### Requirement: Single-use connection URLs

The installed app SHALL be able to mint, using the master sync key, a connection ID that is bound to the sync key, single-use and valid for ten minutes. The app SHALL present the ID as `<origin>/mcp/c/<id>`. That path SHALL serve the same MCP tools before and after the ID is used, with OAuth tokens bound to its own resource audience.

#### Scenario: Mint a connection URL
- **WHEN** the user taps Connect an agent
- **THEN** the app SHALL copy setup instructions containing `<origin>/mcp/c/<id>` to the clipboard
- **AND** SHALL show the URL with its own copy action and its expiry

#### Scenario: Spent URL still serves MCP
- **WHEN** a client holding a valid access token calls `<origin>/mcp/c/<id>` after the ID has been used
- **THEN** the server SHALL serve the request exactly as `/mcp` would

### Requirement: Connection ID recovery during authorisation

An unauthenticated request to `/mcp/c/<id>` SHALL return 401 with `resource_metadata` pointing to `/.well-known/oauth-protected-resource/mcp/c/<id>`. That document SHALL name the resource `<origin>/mcp/c/<id>` and the authorisation server `<origin>/oauth/c/<id>`, whose RFC 8414 metadata advertises endpoints carrying the ID. The server SHALL recover the ID from those endpoints or from the `resource` parameter.

#### Scenario: Client omits resource
- **WHEN** a client authorises through the per-connection metadata without sending a `resource` parameter
- **THEN** the consent screen SHALL still resolve the connection ID to its account

#### Scenario: Client sends resource only
- **WHEN** a client uses the origin-level endpoints but sends `resource=<origin>/mcp/c/<id>`
- **THEN** the consent screen SHALL resolve the connection ID to its account

### Requirement: Connection URL consent

When the authorisation request carries an unexpired, unused connection ID, the consent screen SHALL identify the account without a sync key in the browser. It SHALL show the client name and redirect host, the time the URL was created, and a single Allow action. Allow SHALL consume the ID and issue the authorisation code. Deny SHALL leave the ID unused until expiry.

#### Scenario: Connect from a PWA in a non-default browser
- **WHEN** the user copies a connection URL from a Chrome PWA, pastes it into an agent, and the agent opens the consent page in Firefox
- **THEN** one tap on Allow SHALL return the browser to the client with an authorisation code bound to the PWA's sync key

#### Scenario: Reused connection URL
- **WHEN** a second authorisation request carries a connection ID that has already been consumed
- **THEN** the consent screen SHALL use the fallback approval paths

### Requirement: Full-access consent

The consent screen SHALL offer one Allow action that grants every scope the client requested, with no per-scope or per-data choices. It SHALL state that the agent can read subscriptions, reading statistics and articles, and can change subscriptions and reading state (wording limited to the scopes granted). The client name SHALL be marked unverified when it comes from registration. The page SHALL send `Content-Security-Policy: frame-ancestors 'none'`.

#### Scenario: Default grant
- **WHEN** a client requests no scope and the user taps Allow
- **THEN** the grant SHALL carry `read write`

#### Scenario: Client requests read only
- **WHEN** a client requests only `read`
- **THEN** the consent wording SHALL describe read access only
- **AND** the grant SHALL carry only `read`

#### Scenario: Deny
- **WHEN** the user denies the request
- **THEN** the browser SHALL be redirected to the client with `error=access_denied` and the original `state`

### Requirement: Same-browser approval fallback

When the consent request has no usable connection ID and the consent page's local storage holds a sync key, Allow SHALL submit the decision authenticated with that key in the `X-Sync-Key` header.

#### Scenario: One-tap approval in the PWA's browser
- **WHEN** the consent page opens in the browser that holds the user's sync key and the user taps Allow
- **THEN** the browser SHALL be redirected to the client with `code` and `state`

### Requirement: Approval code fallback

When the consent request has no usable connection ID, the consent screen SHALL show an 8-character, single-use approval code with a copy action, and a QR code of it for the in-app scanner. Under Settings → Agents, the app SHALL accept a pasted, typed or scanned code. It SHALL show the client name, redirect host and scopes before approving. When this device has no sync key, looking up a code (which precedes approving) SHALL turn sync on first. The consent page SHALL poll and redirect once a decision is made.

#### Scenario: Approve by pasted code
- **WHEN** the user copies the code from the consent page, pastes it into the installed app, and approves
- **THEN** the consent page SHALL redirect to the client with an authorisation code bound to the app's sync key

#### Scenario: Expired approval code
- **WHEN** the user enters an approval code more than ten minutes after the request was created
- **THEN** the app SHALL report that the request has expired
- **AND** no grant SHALL be issued

#### Scenario: Sync not enabled
- **WHEN** the consent page has no connection ID and no sync key
- **THEN** the screen SHALL tell the user to open Settings → Agents in Lidora and enter the code, and SHALL show the approval code

### Requirement: Authorisation code exchange

`POST /oauth/oauth2/token` SHALL support the `authorization_code` grant. Codes SHALL be single-use, expire after ten minutes, and be bound to the client, redirect URI, PKCE challenge, scopes and the approving account's isolated provider identity. A successful exchange SHALL return a one-hour signed JWT `Bearer` access token, a refresh token, `expires_in` and `scope`. Refresh tokens SHALL be stored hashed and access tokens not at all; signing keys SHALL be encrypted with the provider secret.

#### Scenario: Code exchange
- **WHEN** a client exchanges a valid code with the matching verifier
- **THEN** the server SHALL return the access token, refresh token and granted scope

#### Scenario: PKCE mismatch
- **WHEN** the verifier does not match the code's challenge
- **THEN** the server SHALL respond `invalid_grant` and SHALL invalidate the code

### Requirement: Refresh token rotation

`POST /oauth/oauth2/token` SHALL support the `refresh_token` grant. Sift SHALL grant `offline_access` to every approved connection. Refresh tokens SHALL expire 365 days after issuance and SHALL rotate on every use; each refresh SHALL extend the agent session to the new refresh token's expiry. Presenting an already-rotated refresh token SHALL revoke every token in that grant. `POST /oauth/oauth2/revoke` SHALL revoke a presented refresh token.

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

### Requirement: Agent read tools

The MCP server SHALL provide read-only tools requiring `read`:

- `list_subscriptions`
- `get_reading_stats`
- `list_items`
- `get_item`
- `discover_feeds` (also open-world)

Each SHALL declare an output schema and return conforming `structuredContent` plus a text rendering. Feeds SHALL be identified by `feedId`, and items by `<feedId>::<guid>`. Without a poll database, `list_items` and `get_item` SHALL NOT be listed.

#### Scenario: Recommend from engagement
- **WHEN** an agent calls `list_subscriptions` with `sort: "engagement"`
- **THEN** each subscription SHALL include its tags and statistics summary, ordered by read index, with `null` indices last

#### Scenario: Summarise recent reading
- **WHEN** an agent calls `list_items` with `feedIds` and `since`, then `get_item` on results
- **THEN** it SHALL receive item metadata and flags, then Markdown content truncated at `maxChars` with a `truncated` indicator and the original link

#### Scenario: Discover a person's blog
- **WHEN** an agent calls `discover_feeds` with a website URL whose page advertises an alternate feed or serves one at a conventional path
- **THEN** the result SHALL list each candidate's feed URL, title, site URL, newest item date, up to three sample titles, and whether the account already subscribes to it

### Requirement: Agent write tools

The MCP server SHALL provide write tools requiring `write`: `subscribe`, `update_subscription` and `set_item_state` (idempotent), and `unsubscribe` (destructive, idempotent). They SHALL apply changes through the same merge logic as `POST /sync/push`. A grant without `write` SHALL NOT list them, and SHALL receive an insufficient-scope error if it calls them.

#### Scenario: Subscribe
- **WHEN** an agent calls `subscribe` with a feed URL and tags
- **THEN** the subscription SHALL be created with the discovered title and site URL and the normalised tags
- **AND** subscribing again to the same URL SHALL return the existing subscription unchanged

#### Scenario: Read-only grant
- **WHEN** an agent holding only `read` calls `unsubscribe`
- **THEN** the call SHALL fail with an insufficient-scope error

### Requirement: Credential redaction in agent output

Every URL returned by an agent tool SHALL have its userinfo removed. Values of query parameters whose names contain `token`, `key`, `secret`, `auth`, `pass`, `sig`, `session` or `code` (case-insensitive) SHALL be replaced with `REDACTED`. Tool arguments, results and URLs SHALL NOT be logged.

#### Scenario: Private feed URL
- **WHEN** a subscription's feed URL is `https://user:pw@example.com/feed?token=abc&page=2`
- **THEN** `list_subscriptions` SHALL return `https://example.com/feed?token=REDACTED&page=2`

### Requirement: Agent rate limits

Requests authenticated with an OAuth access token SHALL draw from per-token rate-limit buckets, separate from the per-sync-key buckets used by devices. `discover_feeds` SHALL additionally be limited per sync key. Exceeding a limit SHALL return a tool error that states the retry interval.

#### Scenario: Agent exhausts its budget
- **WHEN** an agent exceeds its per-token limit
- **THEN** its calls SHALL fail with a retry interval
- **AND** the user's devices SHALL continue to sync unaffected

### Requirement: Connect an agent screen

Settings SHALL have an Agents section, separate from the Devices section, that shows only what connecting and managing agents needs:

- one sentence of explanation and a Connect an agent button (see Single-use connection URLs)
- when this device has no sync key, a note that agents use the copy of the subscriptions and reading progress stored on the Lidora server and that connecting one turns this on
- a "Connected agents" heading followed by the connected agents (see Connected agent identity), each with inline rename and a Revoke that expands an inline confirmation within the agent's row
- a "Have an approval code?" link that reveals code entry with a QR scan option

It SHALL NOT mention sync keys, and SHALL NOT show the plain `/mcp` address or links to machine-readable documents.

The connected-agents list SHALL show a loading state while it loads, "No agents connected" when it is empty, and an error with a Retry action when it fails to load. It SHALL reload after an agent is revoked. A failed rename or revoke SHALL be reported next to the list.

#### Scenario: Connect with sync off
- **WHEN** a user without a sync key activates Connect an agent
- **THEN** the app SHALL turn sync on before minting the connection link
- **AND** if turning sync on fails, SHALL show the error next to the button and leave sync off

#### Scenario: Approval code entry is secondary
- **WHEN** the user opens the section
- **THEN** the approval-code field SHALL be hidden until the user taps "Have an approval code?"

#### Scenario: Revoke a connected agent
- **WHEN** the user activates Revoke on an OAuth grant and confirms in the agent's row
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

### Requirement: Client-neutral setup instructions

The setup instructions SHALL describe Sift as a remote MCP server using the Streamable HTTP transport and OAuth, give the connection URL, ask the agent to add it as a server named "sift" available across the user's projects and to start the sign-in, and ask agents that cannot change their own configuration to say where the user should add the URL. They SHALL NOT name particular clients or ask the agent to fetch anything.

#### Scenario: Agent with a shell
- **WHEN** the user pastes the instructions into a coding agent that can manage its MCP configuration
- **THEN** the instructions SHALL give it everything needed to add the server and start the OAuth sign-in

#### Scenario: Chat-only agent
- **WHEN** the user pastes the instructions into an agent that cannot change its configuration
- **THEN** the instructions SHALL ask it to tell the user where to add the URL

### Requirement: Connected agent identity

Each connected-agent row SHALL show the user's label if set, otherwise the client name, with an "unverified" mark for self-asserted names. One detail line SHALL follow, containing only:

- the client name, when a label hides it
- the client website host, for unverified clients only
- "Read only", when the grant cannot change anything
- when the agent was last used, or "Not used yet"

#### Scenario: Two connections from the same client
- **WHEN** the user connects the same client twice and renames one to "Claude on phone"
- **THEN** the rows SHALL read "Claude on phone" (with "Claude" beneath) and "Claude"

#### Scenario: Rename
- **WHEN** the user renames a connected agent
- **THEN** the new label SHALL be stored server-side, trimmed and at most 64 characters
- **AND** it SHALL appear on every synced device's Agents screen
- **AND** an empty label SHALL restore the default name

### Requirement: Consent page isolation

The consent page at `/connect` SHALL be a standalone page. It SHALL NOT start sync, register a sync key, refresh feeds or create IndexedDB databases, local storage entries or service worker registrations in a browser that holds no Sift data.

#### Scenario: Fresh browser
- **WHEN** the consent page opens in a browser that has never run Sift
- **THEN** the browser SHALL hold no Sift IndexedDB database afterwards

### Requirement: Agent connection discovery document

The system SHALL serve `/llms.txt` as a static asset describing Sift, the MCP endpoint, the OAuth metadata URLs, the OpenAPI document, the scopes, and the bearer header for HTTP use.

#### Scenario: Agent reads llms.txt
- **WHEN** an agent fetches `<origin>/llms.txt`
- **THEN** it SHALL find the MCP URL and how authorisation is obtained
