## MODIFIED Requirements

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
