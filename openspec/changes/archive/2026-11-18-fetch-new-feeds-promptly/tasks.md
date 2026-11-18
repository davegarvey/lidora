## 1. Scheduler

- [x] 1.1 Make a feed with no `lastFetched` and no pending `refreshError` due immediately in `scheduledFeedDueAt`, without jitter.
- [x] 1.2 Add a scheduler entry point that fetches never-fetched feeds without manual-refresh feedback, and call it after sync pulls, first-time setup and subscriptions have reloaded the feed list.
- [x] 1.3 Unit-test the due-time change and the arrival fetch, including that a feed with a fetch time is not refetched.

## 2. River

- [x] 2.1 Show "Fetching <feed>…" (or "Fetching your new feeds…") when every selected feed is awaiting its first fetch and there are no items.
- [x] 2.2 Show a failed first fetch for a single selected feed with its error and a "Try again" button that bypasses client backoff except after rate limiting.
- [x] 2.3 Make "Check for new items" a button with a "Checking…" busy state driven by the manual refresh count.
- [x] 2.4 Test the river state selection.

## 3. Verification

- [x] 3.1 Run typecheck, lint and tests.
- [x] 3.2 Check in the browser that a feed added without items shows the fetching state and then its items.
- [x] 3.3 Validate and archive the change.
