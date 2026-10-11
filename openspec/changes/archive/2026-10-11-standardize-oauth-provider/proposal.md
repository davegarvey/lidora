# Standardize OAuth provider

## Why
Sift implements OAuth itself. Protocol validation, client authentication and token lifecycle belong in a maintained library that works on Workers and self-hosted servers.

## What Changes
- Replace the custom authorization server with Better Auth MCP and CIMD plugins on Workers/D1 and Node/Bun SQLite.
- Preserve the temporary connection link and one-tap browser approval, including across browsers. Keep approval codes as the fallback.
- Keep Sift account authorization and immediate per-agent revocation in a small application layer.
- Require a persistent BETTER_AUTH_SECRET on each deployment. Do not add an AUTH_PROVIDER switch or retain a legacy OAuth engine.
- Invalidate existing OAuth grants at migration; users reconnect agents once. Preserve subscriptions, reading state, device sync and paired CLI tokens.

## Impact
Server OAuth, runtime adapters, migrations, account deletion, token management, README and integration tests. Existing MCP tools and browser reading behavior stay unchanged.
