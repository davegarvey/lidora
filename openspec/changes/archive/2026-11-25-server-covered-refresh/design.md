## Context

The browser scheduler (`src/feeds/scheduler.ts`) ticks every 5 minutes and also arms a timer for the earliest due feed. Both skip only when `document.visibilityState === 'hidden'`. Each due feed is fetched through `/feed`, whatever the server is doing.

When `FEED_POLLING` is on, the Worker polls every registered URL every 30 minutes (`POLL_INTERVAL_MS`) and records the outcome in `polled_feeds` (`failures`, `last_status`, `next_poll_at`, `updated_at`). Clients pull new entries from `/sync/items` after each sync pull. Sync pulls run at boot, on return to the page after more than 5 minutes away, on `online`, on idle catch-up and on manual refresh. There is no periodic pull while a window simply stays open.

`src/util/idle.ts` reports idle after 5 minutes without input. `fireCatchup()` empties its subscriber list, so the single subscriber registered by `state.tsx` runs once per page load.

## Goals / Non-Goals

**Goals:**

- A synced device does not fetch a feed the server is polling successfully.
- An open but unused window makes no feed or sync requests.
- If server polling stops or fails for a feed, the browser takes over without user action.

**Non-Goals:**

- Removing browser fetching. Local-only users, deployments without polling, feeds over the 500-feed cap, new subscriptions and manual refresh still need it.
- Changing the server poll interval or registry.
- Explaining Chrome's own service-worker update checks. They are outside the app's control and are not changed here beyond removing the app's redundant script fetch.

## Decisions

### The server reports coverage on the final items page

When `more` is false, `/sync/items` adds `covered`: an array of `{ feed_id, polled_at, next_poll_at }` for the caller's polled feeds (the same 500 the route already selects) whose `polled_feeds` row has `failures = 0`, `last_status` of `200` or `304`, and `next_poll_at` no more than 60 minutes in the past. `polled_at` is `updated_at`, which the poller writes when it records the outcome.

- `failures = 0` and the status check exclude feeds that are failing upstream, deferred by a local limit, or gone (`410`). For those the browser fetches as before, which also keeps their error state visible.
- The `next_poll_at` grace excludes feeds the poller is not reaching: storage pause (`POLL_DB_MAX_BYTES`), a backlog larger than the batch, or a stopped cron.
- Reporting on the final page only keeps intermediate pages unchanged and costs one indexed query per pull.

Alternatives considered: deriving coverage on the client from the capability flag and the 500-lowest-ID rule. It cannot see failures or a stalled poller, so a failing feed would go silently stale. A separate coverage endpoint would add a request per pull for no benefit.

### The browser holds coverage in memory and treats it as short-lived

`src/sync/coverage.ts` stores the feed IDs from the latest `covered` list with the time it was received. A feed counts as covered only while that report is under 45 minutes old. If pulls stop succeeding, coverage expires and the scheduler resumes fetching on the normal cadence.

Coverage is not persisted. Within a page load, the scheduler does not refresh a previously fetched feed until its jitter (up to 15 minutes) has elapsed, and the boot sync pull normally completes long before that. If the pull fails, the browser falls back to today's behaviour. Persisting coverage would need a settings field, clearing rules tied to the sync cursor and a migration story, for no visible gain.

### Covered feeds take their poll times from the server

When coverage arrives, each covered local feed with an earlier `lastFetched` gets `lastFetched` and `sourceFetchedAt` set to `polled_at`, and `nextCheckAt` set to `next_poll_at`. This keeps "Updated …" in the feed editor truthful. It also means a feed whose coverage lapses becomes due one learned interval after the server's last poll, rather than all covered feeds becoming due at once. Validators (`etag`, `lastModified`) are left alone; the first browser fetch after a lapse may receive `200` instead of `304`, which is harmless. Feeds that have never been fetched locally are not stamped, so `fetchNewFeeds` still fetches them: the server returns only entries it saw after it began polling the URL.

### Automatic refreshes skip covered feeds; explicit refreshes do not

`refreshStaleFeeds` without `forceAll` filters out covered feeds. Manual refresh (`forceAll`, with or without a target) and `fetchNewFeeds` ignore coverage, because the user is asking for the source's current state, and the server's copy may be up to 30 minutes old.

### The scheduler pulls while active

The scheduler gains `setOnScheduledSync`. On each tick that is visible and active, it awaits that callback before refreshing stale feeds, so coverage is current when it filters. `state.tsx` wires it to `pullIfStale(15 minutes)`, which no-ops without a sync key. Pulling every 15 minutes while active, against a 30-minute server poll, delivers polled entries within about 45 minutes. That is comparable to the browser's own minimum cadence of 30 minutes and default of 60.

### Idle pauses automatic work; every return catches up

The tick and the due timer return early when `isIdle()` is true as well as when the page is hidden. `onCatchup` subscribers persist, and `fireCatchup` calls all of them on every idle-to-active transition. `onCatchup` returns an unsubscribe function, which `state.tsx` registers with `onCleanup`. The catch-up subscriber pulls (`pullIfStale(30 s)`), then refreshes due feeds, then reloads items. Returning to the page after more than 5 minutes away, with the user not idle at hide, also refreshes due feeds after its pull.

Trade-off: a window left on screen as a passive dashboard, with no input, stops updating after 5 minutes until the next interaction. Any mouse movement, key or scroll then triggers a catch-up. The cost of updating an unattended window around the clock outweighs that case.

### The service-worker check calls `update()` directly

The hourly interval in `App.tsx` fetched the script with `cache: 'no-store'` and then called `registration.update()`, which fetches it again. It now skips while hidden, offline or installing, and calls `registration.update()` with rejections ignored.

## Risks / Trade-offs

- **[Freshness] Synced users see new entries up to about 45 minutes after publication, not up to 30–60 minutes** → Comparable to the existing cadence. Manual refresh still fetches from the source.
- **[Correctness] A server bug that reports coverage without polling would leave feeds stale** → Coverage requires a recent successful outcome and a `next_poll_at` within 60 minutes. Client coverage expires after 45 minutes without a successful pull.
- **[Behaviour] Idle windows stop refreshing** → Catch-up on the first interaction, and on return to the page, restores currency.
