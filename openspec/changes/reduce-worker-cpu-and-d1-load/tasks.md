## Implementation
- [x] Memoise the sync schema check per database at module level, retrying after failure, and use it from the sync, OAuth and MCP routes.
- [x] Build the Worker's Hono app once per `env` object.
- [x] Add poll migration `0003` with `polled_feeds.body_hash`; hash `200` bodies in the poller, skip parsing and writes on a match, and record the hash with the item batch.
- [x] Read `xml:base` with the extra XML parse only when the document contains `xml:base`.
- [x] Add tests for each behaviour and update README if it describes affected behaviour.

## Validation
- [x] Run typecheck, lint, unit tests and production build.
- [ ] Validate the change strictly, archive it with applied main specs, then run repository spec validation.
