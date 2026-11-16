## 1. Confirm cutover prerequisites
- [x] 1.1 Fast-forward the branch to current main `4f7575b`, including Settings PR #682 and v1.1.0; refresh the inventory and retain the routed Settings specification as the baseline. Reconcile the active Settings proposal before it can be archived.
- [x] 1.2 Inventory the current Worker, D1 IDs/bindings, schedules, routes and guards; retain resource identities and plan both domains against the same backend.
- [x] 1.3 Confirm repository/GHCR target availability, permissions, release rules and Workers Builds triggers; record deployment hold/resume procedure. The `davegarvey/lidora` repository and GHCR package are not present yet; current release rules and workflow behavior were inspected, but rename permissions and Workers Builds routing remain operator checks. Verified at archive (16 November 2026): the repository is `davegarvey/lidora`, and the GHCR workflow publishes `ghcr.io/${{ github.repository }}`.
- [ ] 1.4 Inventory known users/devices and agree migration completion criteria; inspect OAuth invalidation and all browser storage/absolute stored URLs. Issuer validation ties OAuth grants to the configured origin, so clients must reauthorize; app data is in the seven IndexedDB stores, with no separate user-data localStorage/cache to move. User/device inventory and migration-completion criteria remain rollout work. Not verified at archive: user and device inventory cannot be checked from the repository. The ongoing obligation is kept by the `product-rebrand` requirement *Finite coordinated migration*.

## 2. Prepare data transfer
- [x] 2.1 Retain existing same-origin storage and implement a one-action cross-origin transfer covering all seven stores and unsynced state; validate it, make commits atomic and gate sync until completion.
- [x] 2.2 Prepare old-origin migration access, safe destination reconciliation and backup/import recovery; document the PWA reinstall step.
- [x] 2.3 Rehearse malformed-record rejection, browser backup recovery, interrupted transfer/retry and existing-destination handling with local, alternate credential and pending-sync state.
- [x] 2.4 Verify code and tests retain D1 bindings, SQLite filenames and volume mounts; document same-directory upgrades and rollback without snapshot restoration. Live configuration remains a rollout check.
- [x] 2.5 Omit article bodies and state rows left behind after their articles were removed, while keeping source snapshot validation strict for other relationship errors.

## 3. Implement consistent identity
- [x] 3.1 Rename UI/public copy, document titles, sidebar mark, CSS, manifest, export filenames, public metadata, sitemap, robots, OpenAPI and llms.txt.
- [x] 3.2 Rename every header producer/consumer/internal cache key, User-Agent, failure-cache origin, MCP identity and setup instructions atomically.
- [x] 3.3 Rename package/lockfile, environment/config examples, Docker metadata and logs. Configure lidora IndexedDB for the new domain while retaining existing-origin names, SQLite files, volumes and the persistent development directory.
- [x] 3.4 Keep Worker/D1 identities and deployment targets; document phased custom-domain routing, canonical/PUBLIC_URL settings and OAuth reauthorization. External cutover is still pending.
- [x] 3.5 Update README, AGENTS, affected spec deltas, evaluations, test fixtures/assertions and repository/image links; remove retired CLI guidance from maintained docs.

## 4. Validate before release
- [x] 4.1 Run typecheck, lint, build, unit/integration tests, MCP conformance and strict main/change OpenSpec validation.
- [x] 4.2 Verify public/app branding, proxy behavior and custom headers; browser-check the routed Settings UX and migration, including interrupted recovery and concurrent tabs.
- [x] 4.3 Verify Vite, Node, Bun and Docker persistence against existing local data; browser smoke covered Vite, Node/Bun suites passed, and a Docker restart reused the SQLite files. Live Cloudflare account continuity remains a rollout check.
- [x] 4.4 Verify OAuth discovery, issuer/audience checks and reauthorization against the configured new origin; local protocol suites run, live cutover remains pending. Verified at archive (16 November 2026): `https://lidora.app` serves OAuth metadata with issuer `https://lidora.app/oauth` and protected-resource metadata for `https://lidora.app/mcp`.
- [x] 4.5 Audit tracked and generated names and document retained storage/infrastructure and old-origin migration exceptions.

## 5. Coordinate release and migration
- [x] 5.1 Prepare reviewable breaking-change PR/release notes with user and operator migration instructions; verify automated major-release detection. Draft PR #686 includes release evidence and breaking-change instructions; automated major detection remains an operator check because the required local release command is intentionally not run. Verified at archive: v2.0.0 was released by the automated pipeline (#687) after #686 merged.
- [x] 5.2 Publish guided automatic migration and retain access for returning/offline devices; verify no user is stranded before any retirement. Verified at archive: Settings → Storage → Move to Lidora is shipped and documented in the README; the old origin keeps migration access.
- [x] 5.3 Release Lidora on current infrastructure with existing server data and one scheduler; verify both domains and the complete browser transfer before making the new domain primary. Verified at archive: lidora.app serves the application against the existing Worker, D1 databases and scheduler.
- [x] 5.4 Coordinate repository/GHCR rename, build integration and local remotes; publish/pull the new image. Verified at archive: the repository rename and GHCR image are in place; the README documents `ghcr.io/davegarvey/lidora`.
- [x] 5.5 Deploy through the project script and automation; once transfer acceptance checks pass, make lidora.app primary and coordinate public links, canonical metadata and OAuth configuration. Verified at archive: lidora.app is primary, with a canonical link to `https://lidora.app/` and OAuth issued from the new origin.
- [ ] 5.6 Import libraries, reconnect MCP clients, reinstall PWAs as needed and verify live sync/polling/account continuity. Not verified at archive: library imports, MCP reconnections and PWA reinstalls happen on users' devices.

## 6. Finish migration
- [x] 6.1 Retain the existing Worker/databases and browser migration access until remaining users have a durable recovery route. Remove only migration code that is proven no longer needed. Closed at archive as a standing obligation: the `product-rebrand` requirement *Finite coordinated migration* and its returning-user scenario keep the old origin migration-capable until users have a durable recovery route.
- [x] 6.2 Audit public branding and maintained content; list deliberate retained internal names and ensure no unnecessary aliases or duplicate implementations exist. Verified at archive: maintained source, public files, README and AGENTS contain no previous-brand identity apart from the README's upgrade notes. Retained internal names are listed in `inventory.md`.
- [x] 6.3 Archive this OpenSpec change after merge, synchronize specs and remove the worktree when no longer used. Archived on 16 November 2026. Five stale deltas were dropped first: three `agent-connector` requirements and the `reader-ui` welcome state had been rewritten by later changes in Lidora terms, the `reading-font-preference` delta matched main, and the `settings-page` delta repeated the main Settings spec while conflicting with its inline confirmation for agent revocation.
