# Design

## Context

The river currently filters items by selected feeds/tags, read mode and Starred, then returns a bounded newest-first list. `FeedStats` contains lifetime `totalSeen` and `readOnce` counters. Each item also has a stable `createdAt` first-seen time, and `readMarkers` records whether its canonical identity has ever been read. Unread item records are retained for 365 days, so a recent cohort can be derived from existing local data without recording new activity events or reading article bodies. Feeds already retain recent publish-count observations for refresh cadence learning.

The existing per-feed stats baseline is independent of the river scope. The personalized order should follow that principle: selected scope limits candidates, while the preference estimate uses the reader's full current subscription set.

## Goals / Non-Goals

**Goals:**

- Provide an optional, recent and feed-balanced order over the current eligible article scope.
- Let explicit feed-level preferences affect ranking promptly while keeping them bounded and reversible.
- Reuse current item metadata and once-read markers, keep personalization device-local and avoid a detailed event log.
- Keep the UI quiet, accessible and consistent between the river and reading pane.

**Non-Goals:**

- Recommending articles from feeds the reader has not subscribed to.
- Inferring article topics or similarity across different feeds.
- Predicting likes, shares, time-on-page or other social-platform engagement.
- Changing Latest order, read state, starred state, feed refresh, or sync APIs.

## Decisions

### Derive preference from a mature recent cohort

Use items first observed locally 14 to 90 days ago as the initial preference cohort. `createdAt` is the first-seen timestamp; `readMarkers` indicates whether each item has ever been read, including when its current mutable state is unread. Excluding the newest 14 days gives readers time to reach new posts before those posts affect the rate. Compute the all-feed recent baseline across current subscriptions, independent of selected tags or feeds.

Use at most the 200 newest items per feed first observed 14 to 90 days ago, then count their once-read markers. Smooth each feed's recent read-through rate toward the all-feed baseline with a prior equivalent to 10 articles: `(feedReadCount + 10 * baseline) / (feedArticleCount + 10)`. With no usable baseline, For you approaches Latest. These constants are initial internal defaults, not user-facing settings. This uses existing data and adds no per-read timestamps, exposure logs or content analytics.

### Make direct feedback a feed preference

Store one local `neutral`, `more` or `less` preference per feed. Thumbs are placed beside articles because that is where the reader has context, but their accessible names say `More from [feed]` and `Less from [feed]`; they change the feed preference, not an individual article's eligibility. Activating the selected thumb returns the feed to neutral. Direct preference has a bounded, immediate effect on feed weight; repeated reads remain a weaker, smoothed signal. Votes do not change Latest or hide articles.

Keep order mode and feed feedback in local application settings. They do not sync. A device may therefore build a different For you order from another device; this keeps the first version within the existing per-device preference model and avoids changing the sync protocol.

### Merge per-feed chronological queues

Build a chronological eligible queue for each feed in the selected scope, applying feed/tag, read and starred eligibility before ranking. Consider each selected feed's next eligible article when choosing the next result; combine article recency with the feed's smoothed reading preference and bounded direct preference. Advance only the chosen feed's queue, so each feed remains newest-first and candidate volume alone does not grant a source more weight. Apply the existing 500-item presentation bound after feed-aware candidate selection, not to one global newest-first list first. Keep previous/next reading navigation on the exact displayed order.

Add a compound `by-feed-created` IndexedDB index to query the recent preference cohort without scanning all article metadata. This is an additive database-version upgrade from version 11; it does not rewrite article records. The Latest path continues using its existing query behavior.

### Reuse quiet controls

Place the Latest/For you choice in existing navigation/filter chrome, including the mobile drawer and collapsed desktop rail, rather than adding a row above the river. Use compact Lucide icon buttons with selected state and accessible names. Put thumbs beside existing read/star actions in the river, revealed through the current hover/focus treatment, and in the reading pane's existing action area. Touch users must have an equivalent reachable action. Keep current icon meanings intact; thumb labels name the affected feed and selected state.

## Risks / Trade-offs

- [Risk] Opening or marking an article read is only an approximate preference signal. → [Mitigation] Give it a modest, smoothed influence; keep explicit feed feedback available and Latest unchanged.
- [Risk] Device-local feedback may differ between synced devices. → [Mitigation] State local behavior in the control help text and keep the sync protocol unchanged for this version.
- [Risk] Large libraries or many subscriptions could make cohort calculation or queue merging slow. → [Mitigation] Use the compound index, per-feed cursors, a bounded visible result, and performance fixtures before shipping.
- [Risk] A thumbs icon beside one article could be mistaken for an article rating. → [Mitigation] Use accessible labels and hover text that explicitly say More from or Less from that feed; keep the pressed state consistent across its articles.

## Migration Plan

1. Upgrade IndexedDB from version 11 to 12 by adding the `by-feed-created` index; do not rewrite stored article or body records.
2. Default all existing installations to Latest and neutral feed preferences. No historical backfill is required because the ranking derives its cohort from stored `createdAt` values and read markers.
3. If a later release needs to remove or change the feature, ship a forward-compatible migration; do not attempt to downgrade the IndexedDB version.

## Open Questions

None. Initial 14-day maturity, 90-day cohort and 10-article smoothing prior are implementation defaults that can be tuned from observed local behavior without changing the user-facing contract.
