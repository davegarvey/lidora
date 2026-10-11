## 1. Provider and approval bridge
- [x] 1.1 Replace custom protocol code with library configuration and allowlisted routing
- [x] 1.2 Preserve connection links, explicit consent and approval-code fallback
- [x] 1.3 Implement shared JWT validation and immediate grant/account revocation

## 2. Persistence and runtimes
- [x] 2.1 Add provider schema and intentional reconnect migration; remove old OAuth storage
- [x] 2.2 Integrate Workers, Node, Bun and development configuration and safe CIMD transports
- [x] 2.3 Update listing, renaming, revocation, rotation, deletion and cleanup

## 3. Documentation and validation
- [x] 3.1 Update README and protocol contracts
- [x] 3.2 Test cross-browser approval, protocol failures, isolation, refresh and revocation on supported runtimes
- [x] 3.3 Run typecheck, lint, tests, build, conformance and strict OpenSpec validation
- [x] 3.4 Open a PR with verification results and reconnect/configuration requirements

The code-exchange lifetime changes from 60 seconds to the provider’s ten-minute default, and refresh issuance requires `offline_access`. Protocol revocation supports refresh tokens; Settings remains the immediate access-and-refresh kill switch. These deliberate changes are reflected in the connector contract. Existing OAuth grants reconnect once. Archive after merge.
