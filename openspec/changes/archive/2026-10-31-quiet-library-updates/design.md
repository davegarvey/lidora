## Context

The selected design is Header whisper. Mobile list chrome already has a fixed header; desktop does not. Desktop uses a sidebar header or collapsed rail, and reading has its own chrome. Reuse those surfaces rather than adding a desktop river toolbar.

Manual refresh currently awaits network, parse/save and final reload, but background scheduler/sync notifications launch asynchronous reloads through void callbacks. Sync can notify after feeds/flags and again after item ingestion. reloadItems shares its current promise without replaying a data invalidation arriving during that query. All sources must converge on a single coordinator.

An isolated Chromium experiment using 5,000 synthetic articles (~3.4 MB XML), one sample at 4x CPU slowdown, measured 504 ms parsing, 3,418 ms sanitise/write and a 1,073 ms long task. This establishes a risk, not a real-phone latency prediction. End-to-end paint, real-device performance, network and retention were not measured.

## Decisions

### Separate stored data from the presented list

Write incoming data immediately. Maintain a presented sequence of article IDs and a current candidate result for the active selection. Deferral concerns presentation, not persistence, cursors or deduplication. Do not retain two copies of article bodies. Recompute pending results from current storage and predicates rather than incrementing an arrival counter.

Gate background membership and ordering changes only after initial hydration has presented a non-empty list. Treat resume and idle catch-up as background updates. New feed/tag/read/star filter selections establish a fresh presentation baseline. Your own read/star actions update immediately; if they require a query, keep unrelated pending arrivals excluded. If local actions empty the list, publish eligible pending results automatically. Feed removal, identity changes and missing stored records must not leave stale actionable rows; reconcile those changes immediately, preserving an eligible neighbour where possible.

Remote flag changes that would remove or reorder rows are deferred; harmless metadata/flag changes may be reflected without moving rows. If any deferred change is not explained by additions alone, prefer `Show updates` to a misleading count. Count distinct additions to the current candidate presentation, after scope, filters and the existing 500-result limit. Do not count articles outside that result or articles already presented. Repeated batches replace the candidate and count. Clear the action when no meaningful difference remains.

### Distinguish explicit intent from background work

Explicit refresh commits its final reconciled result even when automatic arrivals are off. Preserve the first visible article ID and its pixel offset, plus keyboard-focused article ID, when still eligible; otherwise use the nearest surviving neighbour. Do not restore by old numeric index.

Show commits the newest fully reconciled candidate, moves the list to the top without smooth scrolling, and moves keyboard focus to the first article control when the activating button disappears. If more work is running, keep the Show control available: apply the latest complete candidate and retain activity/pending state for later results. Serialise commits and data revisions so a newer arrival is neither dropped nor falsely counted as shown. The action fetches no upstream data.

Do not replace, navigate or scroll the open article because library data arrived, in either preference mode. Keep the list snapshot through article open/close, except immediate local read/star consequences and existing return-to-item/neighbour rules. In manual mode, returning from reading alone is not permission to insert arrivals. In automatic mode, updates may affect a visible desktop list but must preserve its anchor. Do not show a pending-arrival CTA in a phone reader: it has no visible list to act on. Show it on return; activity alone may appear in reader chrome.

### One local preference

Store `automaticallyShowNewArticles` in existing local AppSettings with absent values interpreted as false; no database version bump solely for this optional settings field. Place it in Appearance without adding a section. It does not sync: separate devices may have different reading preferences.

Label: `Automatically show new articles`. Description: `Add articles to the list as they arrive. This may move articles you’re browsing.` Enabled means background list reconciliation applies automatically, including related remote list changes, while preserving the visible anchor and focus where possible. Enabling commits pending changes on next list presentation; disabling establishes the currently presented list as the baseline and holds subsequent changes. Neither action interrupts an open article.

### Activity is an operation lifecycle

Track scoped operation tokens and data revisions, not one network count. Cover manual and automatic feed work, sync ingestion, hydration, resume/catch-up, relevant cleanup, querying, and publication or pending-result calculation. Upload-only queue flushing, unrelated statistics and future retry backoff do not keep activity active. Include scheduled reconciliation in the lifecycle before releasing the originating token. Coalesce invalidations and replay a query when its data revision becomes stale. An unrelated feed must not leave the selected view looking permanently busy; scope operations where known and use a conservative global classification during library-wide merges.

A held candidate is settled work: activity can end while its Show action persists. A new operation can run while an earlier candidate is available. Status must communicate both without hiding the actionable candidate; reserve the activity icon alongside the CTA in the same slot. Do not steal its focus when state changes. Error and cancellation paths release their tokens; existing actionable error surfaces remain. Do not claim a successful update on failure.

Delay passive activity appearance by 300 ms and keep it visible at least 300 ms once shown. Manual refresh still receives immediate existing button feedback. Keep a displayed activity cue through a post-publication rendering opportunity. requestAnimationFrame is not proof of paint; hidden tabs must not hang waiting for frames. On visibility return reconcile outstanding revisions before clearing the cue. Use a completion task/frame strategy verified in browser tests, not arbitrary delays to mask untracked work.

### Placement and accessibility

Mobile list: trailing slot in the existing top bar, preserving centred wordmark and sidebar target. Desktop expanded sidebar: existing header area. Collapsed navigation: existing refresh/rail position for a Lucide activity icon; place a pending text action in available reading chrome rather than squeezing words into the 44px rail. Reader activity shares existing chrome without moving its controls. In focus mode, retain quiet reader activity and keep pending list actions for return. Render one operative status/action per visible list and one polite announcement source; avoid duplicate live regions across mounted hidden surfaces.

Use neutral text/icon colours. `Updating…` is noninteractive text; `Show N new` and `Show updates` are underlined native buttons, with descriptive accessible names, keyboard focus styles and >=44px effective touch targets. The longest label must fit at 320px and with text enlargement; use `Show new` plus an exact-count accessible name if an unusually large count cannot fit, never a count-only label. No new row, overlay or shifting header controls. Respect reduced motion. Announce availability once per pending episode, not each batch/count increment; do not announce every processing phase. Clear quietly on completion.

### Processing strategy

Measure parse, convert, sanitise, storage, selection, Solid publication and browser rendering separately. Chunk sanitisation before opening write transactions so the browser can process input; do not yield arbitrarily inside an active IndexedDB transaction. Evaluate worker parsing or another measured way to remove synchronous XML parsing from the UI thread. Preserve existing sanitisation, merge, identity, stats and atomicity guarantees. Avoid gratuitous whole-library scans/re-renders; optimise query access only if measurements justify it. Document any necessary schema/index work in the implementing change before coding it.

## Validation

Test lifecycle races, stale-query replay, partial failure, duplicate batches, filtered/limited counts, pending updates concurrent with local actions, repeated Show, manual refresh, settings changes and reader return. Browser checks cover 320/390/768/820/1440px, expanded/collapsed navigation, focus mode, coarse pointers, keyboard/screen readers, reduced motion and text enlargement. Compare 1,000/5,000 article fixtures before/after under CPU throttling, with frame/input probes during processing and through final rendering. Include a real mobile-device check; record gaps honestly rather than treating emulation as equivalent.

### Implementation validation record

- The isolated Chromium baseline at 5,000 articles and 4× CPU slowdown measured 504 ms parsing, 3,418 ms sanitising/writing and a 1,073 ms main-thread long task. After moving XML parsing to a module worker and yielding between sanitisation batches, the same harness measured 147 ms awaiting worker parsing, 4,026 ms sanitising/writing, 12 ms for the selected query and 109 ms for a full scan, with no main-thread long tasks during ingestion. CDP throttles the main thread; it does not model a physical phone or the worker's CPU speed.
- Browser checks passed 10/10 flows, including held arrivals and Show, delayed activity, explicit refresh, reader return, automatic arrivals, local last-unread refill, settled scroll-anchor preservation, and controls at 320/390/768/820/1440 px with collapsed reader navigation at 820 px. A separate 5,000-article publication/render probe took 6.1 seconds overall, with a 216 ms maximum frame gap and main-thread long tasks up to 128 ms during final publication. The ingestion path itself did not produce long tasks.
- A real mobile-device check, screen-reader verification and enlarged-text verification remain outstanding. Browser emulation is not a substitute for those checks.
- The archived change and all four affected specs passed strict validation. Repository-wide strict validation reported 37 passing and 20 failing specs outside this change; the npm script also could not use the root-owned npm cache. The affected `event-driven-refresh`, `library-updates`, `refresh-feedback` and `settings-page` specs passed with the installed OpenSpec CLI.

## Risks and non-goals

The coordinator must not defer data writes or delay server cursors. Stable list snapshots must not leak deleted data or resurrect local read items. Pending state is ephemeral and is reset on a full app load; only the preference persists. Server-origin updates reach the browser through existing pulls; this change adds no push transport. No percentage progress, per-feed toggles, cross-device preference sync, continuous phase labels or new error policy. An activity cue is not a substitute for reducing blocking work.
