# Agent connection lifetime

## Why
The move to Better Auth (#661) broke the "connect once" promise in two ways, both confirmed in the library source.

1. Codex and ChatGPT would have to reconnect every hour. The library issues a refresh token only when the granted scopes include `offline_access`. It also leaves `offline_access` out of the protected-resource metadata, so clients don't know to ask for it. Codex and ChatGPT request `read write`, and get a one-hour access token with nothing to renew it. The tests requested `offline_access` explicitly, so they missed this.
2. Connections end 365 days after approval, even if used daily. Refresh tokens already renew their 365-day lifetime on each rotation. But the provider session is created at approval with a fixed 365-day expiry, and both Sift's token check and the daily cleanup end the connection at that point. The agreed behaviour was expiry after a year without use.

A related issue becomes more important once sessions slide: a connection whose refresh tokens have all been revoked (for example after refresh-token replay) stays listed until its session expires.

## What Changes
- Every approved connection receives a refresh token. Sift adds `offline_access` to authorization requests and client registrations that ask for `read` or `write` without it, before the library processes them.
- Each successful refresh extends the agent session to the new refresh token's expiry. A connection ends only after 365 days without a refresh.
- A connection with no usable refresh token stops being listed and is removed by the daily cleanup. Connections still awaiting their code exchange are not affected.
- Tests use the scopes, grant types and authentication methods from the Codex and ChatGPT fixtures, including a successful refresh after the access token expires.
- Compatibility is confirmed live before it is claimed: Codex and ChatGPT reconnect on production while the D1 data is watched, and Codex is checked again more than an hour later.

## Impact
Server OAuth routing, provider configuration, resource authentication, token listing, scheduled cleanup and OAuth tests. No migration and no client-visible change apart from the token response's `scope`, which now includes `offline_access`. Existing connections do not need to reconnect beyond the one-time reconnect #661 already requires.
