# Tasks

## 1. Recent preference data and local settings

- [x] 1.1 Add the `by-feed-created` IndexedDB index in a version 11 to 12 upgrade, update the database-version and retention specs, and verify existing article records open with their values unchanged and the new index available.
- [x] 1.2 Derive each feed's mature recent read-through rate from items first observed 14 to 90 days ago and their once-read markers, smoothed toward the all-feed baseline with the 10-article prior; verify boundaries, sparse feeds and no-baseline behavior.
- [x] 1.3 Persist Latest/For you and neutral/more/less per-feed preferences locally with Latest/neutral defaults; verify toggling, reload, backup/restore behavior and that sync payloads are unchanged.

## 2. Candidate selection and ordering

- [x] 2.1 Build scoped per-feed chronological candidate queues and merge them using article recency, smoothed preference and bounded direct preference; verify per-feed chronology and that high article volume alone does not dominate.
- [x] 2.2 Apply feed/tag, read and starred eligibility before For you ranking and the 500-item display bound; verify a quiet selected feed is represented in the candidate set even when another feed publishes frequently.
- [x] 2.3 Route next/previous article navigation through the same displayed order and preserve the current-item retention behavior in Unread mode; verify transitions for Latest and For you.
- [x] 2.4 Update the `unread-article-filter` requirement and add query/ranking coverage for scope composition, result limits and navigation; verify the focused filter/query suite passes.

## 3. Quiet, steerable controls and documentation

- [x] 3.1 Add the Latest/For you control to existing filter/navigation chrome on expanded, collapsed and mobile layouts; verify default, selected state, keyboard/touch access and absence of a new river header row.
- [x] 3.2 Add thumb controls to the existing river and reading-pane article action areas; verify accessible labels say More from or Less from the named feed, selected state is consistent across that feed's articles, activating the selected choice clears it, and touch users can reach the controls.
- [x] 3.3 Update the README to describe For you ordering, feed-level feedback and device-local behavior; verify the copy matches the implemented controls and scope.

## 4. Integrated verification

- [x] 4.1 Verify Latest remains newest-first and unchanged, For you composes with all active filters, no network request is needed, and a new or sparse library falls back toward Latest.
- [x] 4.2 Run focused UI/database coverage, typecheck, lint, build and strict validation for this change; resolve any spec or implementation divergence before completion.

## Workflow follow-up

- After implementation is complete, archive this change and include the archived change plus synchronized main specs in the implementation PR.
- Run `npm run spec:validate` after archival and verify the change is no longer active.
