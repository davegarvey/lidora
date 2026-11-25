## Why

A single synced Chrome window left open for a day produced about 2,200 `/feed` requests, roughly 100 an hour through the night. Two causes compound:

- With server polling enabled, the Worker already polls each synced subscription every 30 minutes and serves new entries from `/sync/items`. The browser scheduler still fetches every feed on its own learned cadence, so each feed is fetched once by the server and again by every open device. The server-polling change left browser fetching unchanged on purpose; the duplication it named as a cost was never removed.
- The scheduler pauses only while the document is hidden. A desktop window behind other windows, or an installed app window on another desktop, stays visible, so refreshes continue while nobody is using the app. The idle detector exists but only suppresses list reloads, and its catch-up subscriber is discarded after the first idle-to-active transition, so catch-up runs at most once per page load.

Each `/feed` call is a billable Worker request even when it is answered from the shared cache or with `304`.

## What Changes

- The final page of `GET /sync/items` reports which of the caller's feeds the server is currently polling successfully, with the time of the last successful poll and the next scheduled poll.
- Automatic browser refreshes skip feeds the server reports as covered. The browser records the server's poll times on those feeds, so the refresh status and cadence stay accurate and browser fetching resumes on the normal schedule if coverage lapses. Manual refresh, first fetches of new feeds, local-only mode, deployments without polling and feeds beyond the per-account cap keep browser fetching.
- While the user is active, the scheduler tick runs a sync pull at most every 15 minutes, so a long-open window receives server-polled items without fetching feeds itself.
- Automatic refreshes and scheduled pulls pause while the user is idle as well as while the page is hidden. Every idle-to-active transition triggers a catch-up that pulls and refreshes due feeds, and returning to the page after an absence refreshes due feeds as well as pulling.
- The hourly service-worker check calls `registration.update()` only, without first fetching the script itself.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `server-feed-polling`: the items pull reports coverage; browsers defer automatic refreshes of covered feeds and pull periodically while active.
- `user-idle-detection`: catch-up fires on every idle-to-active transition and refreshes due feeds; automatic refreshes pause while idle.

## Impact

- `server/sync/routes.ts` (`/sync/items` coverage query).
- `src/sync/client.ts`, `src/sync/merge.ts`, a new `src/sync/coverage.ts`, `src/feeds/scheduler.ts`, `src/util/idle.ts`, `src/state.tsx`, `src/App.tsx`.
- Tests in `tests/feed-polling.test.ts`, `tests/feeds-scheduler.test.ts` and the sync item-pull tests.
- README feature and polling text.
- No migrations, no new dependencies. Coverage is held in memory per page load; until the first pull of a page load, the browser behaves as it does today.
