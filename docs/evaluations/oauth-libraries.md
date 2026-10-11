# OAuth library evaluation and decision

Sift uses Better Auth 1.7.7 with its MCP, OAuth provider, JWT and CIMD plugins across Workers/D1 and Node/Bun SQLite. One implementation avoids maintaining two authorization servers. Runtime adapters select storage and safe outbound metadata transport; no provider-selection environment variable is needed.

## Alternatives evaluated

| Candidate | Deployment fit | Decision |
| --- | --- | --- |
| Better Auth MCP/OAuth/CIMD | Shared Web Request/Response handler; D1 and SQLite | Adopted after Node, Bun and workerd prototypes |
| Cloudflare OAuth provider | Workers-specific imports and KV storage | Rejected because self-hosting would require a second provider |
| oidc-provider | Documented Node runtime | Rejected because it does not supply the shared Workers path |

## Preserving convenient approval

The user chose to retain temporary connection links because they let someone approve in a browser that has never run Sift. Each link retains its issuer and resource paths. The library validates protocol requests and signs the approval query; Sift resolves the account, requires explicit consent and consumes the link once. Expired or used links can use explicit account/code approval.

An approval creates an isolated provider identity and session linked to the Sift account in application metadata. Cookies remain server-side. JWT access tokens carry an opaque identity, not the sync key. Online account, grant, session and refresh-family checks preserve immediate revocation. Separate identities prevent one agent’s refresh replay or revocation from affecting another approval to the same client.

## Verification and limits

Automated integration tests exercise dynamic registration, captured Codex metadata and ChatGPT metadata with synthetic signed client assertions on Node 26.5.0, Bun 1.3.0 and workerd/D1. These are fixture-based compatibility checks, not observed live connections from Codex or ChatGPT. ChatGPT’s preferred `private_key_jwt` method is validated; assertions are no longer ignored.

Node and Bun use the library’s public-DNS validation and connection-pinned HTTPS transport. Workers combine Sift public-address validation with platform public Internet egress (`global_fetch_strictly_public`); Workers fetch does not expose DNS pinning. Both transports refuse redirect following and apply shared origin pacing, a ten-second deadline and a 64 KiB body cap. Tests cover private-address refusal and wrapper boundaries.

Refresh reuse has zero overlap. Access tokens last one hour; refresh tokens require `offline_access`. The agent session expires after one year. Protocol revocation supports refresh tokens, while Settings removes the isolated identity and invalidates all credentials immediately. DPoP is disabled because Sift accepts bearer credentials.

## Migration and operation

Migration 0013 removes custom OAuth tables, credentials and refresh-family columns. Existing OAuth agents reconnect once. Paired CLI credentials, device sync and reading data are retained. A persistent `BETTER_AUTH_SECRET` of at least 32 characters is required before deployment, and `PUBLIC_URL` identifies the public origin behind a reverse proxy. Missing secret configuration fails closed for OAuth while device sync continues.

The lockfile audit reports the same ten existing advisory entries as the baseline, with no added advisory packages. Unrelated dependency upgrades are outside this change. Architecture and intentional contract changes are recorded in `openspec/changes/archive/2026-10-11-standardize-oauth-provider/`.

## Primary references

- [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)
- [Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider)
- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono)
- [Better Auth SQLite](https://better-auth.com/docs/adapters/sqlite)
- [Better Auth database and D1 migrations](https://better-auth.com/docs/concepts/database)
- [Cloudflare OAuth provider](https://github.com/cloudflare/workers-oauth-provider)
- [Cloudflare provider storage model](https://github.com/cloudflare/workers-oauth-provider/blob/main/storage-schema.md)
- [Node oidc-provider](https://github.com/panva/node-oidc-provider)

