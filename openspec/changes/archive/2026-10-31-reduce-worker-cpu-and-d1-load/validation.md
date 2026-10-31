# Validation

Implemented by a delegated sub-agent and reviewed before merge.

- Typecheck, lint, production build and 834 unit and integration tests passed (`NODE_OPTIONS=--no-experimental-webstorage` on local Node 24).
- `server/sync/schema.test.ts` checks that the schema statements run once per database across concurrent and later callers, separately per database, and again after a failure.
- `tests/feed-polling.test.ts` checks that an identical body from a feed without validators is neither parsed nor written, that a changed body is parsed and its hash recorded, and that a parse failure leaves the hash unchanged.
- Existing `xml:base` tests cover documents with and without `xml:base`.
- Production effect to check after deploy: CPU time in polling-cron minutes and `sift-sync` read queries per Worker request in Cloudflare analytics.
