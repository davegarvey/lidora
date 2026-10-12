## 1. Refresh tokens for every connection
- [x] 1.1 Add `offline_access` in the authorization router when the requested scopes include `read` or `write` without it, alongside the existing `resource` defaulting
- [x] 1.2 Apply the same mapping to scopes declared at dynamic client registration
- [x] 1.3 Test with the Codex and ChatGPT fixtures' exact scopes: the token response has a refresh token, and a refresh after the access-token lifetime succeeds
- [x] 1.4 Test a DCR client that registers and authorises with `read write`

## 2. Expiry after a year without use
- [x] 2.1 After each successful refresh, extend the session to the newest unrevoked refresh token's expiry, never shortening it and never recreating a deleted session
- [x] 2.2 Test with a controlled clock: refreshes at 364-day intervals keep the connection, and 365 days without refresh end it

## 3. Ended connections
- [x] 3.1 Omit grants older than ten minutes without a usable refresh token from `GET /sync/tokens`
- [x] 3.2 Remove the same grants, with their provider user and credentials, in the daily cleanup
- [x] 3.3 Test listing and cleanup after refresh-token replay, and that a grant awaiting code exchange survives both

## 4. Validation and release
- [x] 4.1 Align the open `agent-connector` change so archiving it does not restore the fixed one-year session or the `offline_access` precondition
- [x] 4.2 Run typecheck, lint, tests, build, conformance and `openspec validate agent-connection-lifetime --strict`
- [ ] 4.3 Open a PR, merge and deploy

## 5. Live compatibility
- [ ] 5.1 Reconnect Codex on production while watching `agent_grants`, `session` and `oauthRefreshToken`; confirm a refresh token was issued
- [ ] 5.2 Reconnect ChatGPT the same way; record the token endpoint authentication method used, and decide on `private_key_jwt` from the result
- [ ] 5.3 Confirm the Agents screen shows both connections with the expected identity and details
- [ ] 5.4 More than an hour after 5.1, run a Codex tool call; confirm a rotation occurred and the session expiry moved forward
- [ ] 5.5 Archive this change once 5.1–5.4 pass

Implementation note: the session extension runs in Sift's token-route wrapper (`server/agent/oauth/lifetime.ts`), the fallback the design allows; it needs no library hook and runs identically on every runtime. Resource authentication now requires an active refresh token for every grant, matching the listing and cleanup rule.
