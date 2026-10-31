## Context
Evidence from Cloudflare analytics and the `sift-poll` database, 24–31 October 2026:

| Measure | Value |
|---|---|
| CPU in cron minutes vs other minutes (27–30 Oct) | 368 s vs 24 s |
| CPU per poll run | median ~500 ms, max 3.7 s |
| Polled feeds / without validators | 64 / 12 |
| New polled items, last 24 h | 406 |
| `sift-sync` read queries per Worker request | ~35 |
| Local cost of building the app per request | 0.18 ms vs 0.008 ms reused |
| `xml:base` pass as share of `parseFeed` (synthetic 426 KiB feed) | 0.7 of 3.4 ms |

## Decisions
- **Hash the body, not the parsed items.** The point is to avoid parsing. SHA-256 through `crypto.subtle` is native and available in Workers, Node and Bun. The hash is stored in a new nullable `polled_feeds.body_hash` column (poll migration `0003`). It is written in the same batch as the item inserts, so a failed parse or write never records a hash. A hash match is reported as `unchanged`.
- **Memoise schema checks per database at module level** with a `WeakMap<D1Database, Promise<void>>`, matching `feed-state.ts` and `origin-governor.ts`. A rejected promise is removed so the next caller retries. This fixes the problem regardless of how adapters construct the app.
- **Also build the Worker app once per `env` object** (`WeakMap` keyed by `env`), which removes per-request route registration. This is cheap insurance, not the main saving.
- **Guard the `xml:base` parse with a substring check.** Documents without `xml:base` return the base URL unchanged, which is the current result for them.

## Risks
- A feed that changes only in ignored whitespace is still reparsed; acceptable.
- Expired items from an unchanged feed are no longer reinserted with a fresh `first_seen_at`. This is the intended retention behaviour.
