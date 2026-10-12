# Design

## Refresh tokens for clients that do not request `offline_access`

The library's `createUserTokens` issues a refresh token only when the client allows the `refresh_token` grant and the granted scopes include `offline_access`. The MCP plugin removes authorization-server-only scopes such as `offline_access` from the protected-resource metadata, so MCP clients request only the resource scopes they are shown. Codex and ChatGPT both declare the `refresh_token` grant in their metadata documents and request `read write`. No library option changes this.

The options considered were:

- **Adding the scope at consent.** Not possible: the library's consent endpoint can only narrow the scopes in the signed request.
- **Advertising `offline_access` as a resource scope.** The plugin strips it from the metadata, and clients are not obliged to request every advertised scope.
- **Patching the library.** This adds upgrade friction for a policy Sift can apply at its own boundary.
- **Mapping the scope at the authorization router (chosen).** Sift's router already supplies the `resource` parameter when it is missing, before the library sees the request. The same step adds `offline_access` when the requested scopes include `read` or `write` and lack it. The library then validates and signs the mapped request, so the consent page, the approval record, the grant and the issued tokens all agree. A request with no `scope` already receives the configured scopes, which include `offline_access`.

The library checks requested scopes against a client's registered scopes when the client has any. A client that registers through DCR with `scope: "read write"` would therefore be refused the mapped request. The registration route applies the same mapping to explicitly registered scopes. CIMD clients have no registered scopes and need no change.

The token response's `scope` will read `read write offline_access` where the client asked for `read write`. RFC 6749 §3.3 allows the issued scope to differ from the requested one, provided the response states it, which the library does. Sift's MCP authorization reads only `read` and `write`, and the Agents screen labels access from `write`, so neither changes.

## Expiry after a year without use

Refresh-token rotation already slides: each rotation issues a token that expires 365 days after its issue time. The fixed limit is the provider session. It is created at approval with a 365-day lifetime and never extended, because agent sessions are never used through cookies. Sift's resource authentication rejects tokens once the session expires, and the daily cleanup deletes connections by session expiry.

After each successful `refresh_token` grant, Sift sets the session's `expiresAt` to the expiry of the newest unrevoked refresh token for that session, in the library's stored date format. This is one conditional update tied to the session that issued the refresh token. It never shortens a session, and it is skipped if the session has been deleted, so revocation cannot be undone by a concurrent refresh. A library `after` hook on the token endpoint is preferred. If the hook cannot see the grant outcome reliably, a Sift wrapper around the token route that inspects the successful response is acceptable.

The alternatives were:

- **Extending the session on every MCP request.** This adds write load for no benefit: access tokens last one hour, so any use within a year refreshes within the hour.
- **Dropping session expiry checks in favour of refresh-token liveness.** This would make library introspection disagree with Sift and leave cleanup keyed to a value that no longer means anything.

## Connections that can no longer be used

Resource authentication already rejects a grant with no unrevoked, unexpired refresh token. Listing and cleanup should use the same test. A grant created more than ten minutes ago (the authorization-code lifetime) with no usable refresh token is ended: `GET /sync/tokens` omits it, and the daily cleanup deletes its provider user, grant and credentials, as it does for expired sessions. The ten-minute grace covers approvals whose code has not yet been exchanged.

## ChatGPT signed-key client authentication

Sift advertises `private_key_jwt`, which ChatGPT prefers, but it has only been tested with generated keys. This change keeps it and adds no code for it. The live ChatGPT reconnect is the test. If it fails, the fallback is to stop advertising `private_key_jwt`. ChatGPT also supports `none`, so a failure costs a configuration change, not a redesign. That decision is taken on the live evidence.

## Verification

Automated tests use the client metadata, scopes and authentication methods in `tests/fixtures/oauth-clients/` without adding `offline_access`. They cover:

- the token response for a client that requested only `read write`;
- a refresh after the access-token lifetime, using a controlled clock;
- session extension across a refresh, using a controlled clock;
- expiry after 365 days without refresh;
- removal from the listing after refresh-token replay;
- a DCR client registering `read write`.

The existing tests that request `offline_access` explicitly remain.

The live check runs on production:

1. Reconnect Codex and ChatGPT while watching `agent_grants`, `session` and `oauthRefreshToken` in `sift-sync`.
2. Confirm each grant has a refresh token and that the ChatGPT token exchange used the advertised authentication method.
3. More than an hour after the Codex reconnect, run a Codex tool call. Confirm that a refresh-token rotation occurred and that the session expiry moved forward.

Compatibility is claimed only after these steps pass.
