## Why

The project is becoming Lidora at `https://lidora.app`. Its early user base makes this the right time to replace the old product identity across the application, protocols, public hosting and distribution. A breaking release is accepted; permanent aliases and fallback configuration would undermine that decision.

## What Changes

- **BREAKING**: replace Sift branding, custom headers, MCP identity, environment variable, container identity and hosted origin with Lidora equivalents.
- Preserve existing browser libraries and server accounts through a low-friction browser transfer while retaining existing server storage.
- Reconnect MCP clients against the new OAuth issuer/resource and publish updated setup instructions.
- Rename the repository and container distribution, update current documentation and specifications, and retire obsolete CLI instructions.
- Keep immutable historical evidence (Git history, archived proposals, applied SQL migrations) intact. Old-name references in temporary migration material have a defined removal milestone.

- Retain existing D1 names/IDs, SQLite filenames, persistent volumes and Worker identity. Use `lidora` for new-domain browser storage; retain the existing database name on established origins. No storage move solely for branding.

## Capabilities

### New Capabilities
- `product-rebrand`: consistent identity, finite data migration, coordinated cutover and removal criteria.

### Modified Capabilities
- Existing specifications containing product names, public headers, public interfaces or deployment examples receive matching terminology changes. Their behavior remains unchanged except for the explicit breaking rename and migration requirements defined here.

## Impact

Browser/PWA UI, public pages, SEO, MCP/OAuth, proxy consumers, all server adapters, IndexedDB, SQLite, Cloudflare Worker/D1, GitHub/GHCR, release automation, tests and maintained docs. Users must move their browser library and reinstall the PWA where needed; MCP users must reconnect; self-hosters update configuration and image while keeping their existing files and volume mounts. No application or infrastructure changes are made by this planning change.
