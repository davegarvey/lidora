# Design

Use Better Auth 1.7.7 with its MCP, OAuth provider, JWT and CIMD plugins. One implementation uses D1-compatible database access on all runtimes. Node and Bun use the pinned-DNS CIMD transport; Workers validate DNS through Sift's public-address checks and use the platform's public Internet fetch boundary (`global_fetch_strictly_public`), with redirects refused. Workers fetch does not expose connection pinning; the platform egress restriction closes the private-network rebinding boundary. Both transports share origin pacing.

Each temporary connection has its own issuer path and resource URL, as in the current onboarding. The library generates discovery documents and validates OAuth requests. A library-signed authorization query reaches Sift's approval bridge; it cannot be replaced by client-supplied callback data. An approval creates an isolated provider identity and session for that agent, linked to the Sift account in application metadata. Provider session cookies remain server-side. They never become a new browser login mechanism.

The account bridge consumes connection links once, supports approval by master key or fallback code, and requires explicit consent. It does not issue or validate OAuth codes or refresh tokens. Resource authentication verifies library-issued JWT signatures, issuer, audience and expiry, then checks the account and active grant online. Revocation deletes the isolated identity and its credentials. Rotation/deletion of the underlying Sift account also stops access immediately.

Persist provider schema through checked-in migrations. Remove the custom protocol routes and tables on cutover. Existing OAuth clients reconnect; there is no compatibility token verifier. Keep the independently shipped paired CLI authentication until its existing retirement conditions are met.

BETTER_AUTH_SECRET is required for OAuth, shared across replicas and persistent across restarts. Missing configuration fails closed without disabling device sync. PUBLIC_URL defines the externally visible origin. Library protocol endpoints are allowlisted; signup, session creation and account-management APIs are never exposed.
