## 1. Server

- [x] 1.1 Add `covered` to the final `/sync/items` page using the polling-state rule, with Miniflare tests for covered, failing, deferred, never-polled, overdue and multi-page cases.

## 2. Client coverage

- [x] 2.1 Add `src/sync/coverage.ts` holding the latest covered IDs and their receipt time, with a 45-minute validity.
- [x] 2.2 Parse `covered` in the items pull client, record it after a complete pull, and stamp covered feeds' poll times.
- [x] 2.3 Skip covered, previously fetched feeds in automatic refreshes only.

## 3. Scheduling and idle

- [x] 3.1 Add `setOnScheduledSync` to the scheduler, await it on active visible ticks, and wire it to `pullIfStale(15 minutes)`.
- [x] 3.2 Skip ticks and due timers while idle.
- [x] 3.3 Keep catch-up subscribers across transitions, return an unsubscribe, and refresh due feeds in the catch-up and on return to the page.
- [x] 3.4 Simplify the hourly service-worker check to `registration.update()`.
- [x] 3.5 Cover coverage filtering, idle gating, scheduled pulls and repeated catch-up with tests.

## 4. Wrap-up

- [x] 4.1 Update the README.
- [x] 4.2 Run typecheck, lint, tests and `openspec validate server-covered-refresh --strict`.
