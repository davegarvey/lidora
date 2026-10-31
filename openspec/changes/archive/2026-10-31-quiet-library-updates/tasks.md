## 1. Baseline and architecture
- [x] 1.1 Add isolated large-library profiling and capture before/after baselines for parse, sanitise/write, query, publication, rendering and input responsiveness.
- [x] 1.2 Map update origins and add scoped operation/revision tracking with awaited reconciliation, stale-query replay and error cleanup.
- [x] 1.3 Preserve manual refresh scope/coalescing, idle/resume gates and quiet error policy; keep upload-only and retry work outside activity.

## 2. Stable presentation
- [x] 2.1 Hold a fresh candidate separately from the presented articles; gate membership/order changes and compute filtered, deduplicated, result-limit-aware pending state.
- [x] 2.2 Implement Show latest from the top, including concurrent incoming work and focus transfer.
- [x] 2.3 Apply explicit refresh and new scope/filter results immediately; preserve anchors by article ID and offset where possible.
- [x] 2.4 Preserve local read/star actions, safe removal, empty-list filling and reader return/neighbour behavior while holding unrelated arrivals.

## 3. Preference and chrome
- [x] 3.1 Add the local default-off automatic-arrival setting in Appearance, including migration-by-default, persistence failure feedback and preference transitions.
- [x] 3.2 Implement Header whisper in existing mobile, desktop and reader chrome, including collapsed navigation and focus mode, with no added row or overlay.
- [x] 3.3 Distinguish status from underlined Show actions; handle activity delay/minimum dwell, reduced motion, touch targets, one live announcement and narrow layout.

## 4. Large-library responsiveness
- [x] 4.1 Split feed HTML sanitisation into bounded batches before opening IndexedDB write transactions.
- [x] 4.2 Move browser XML parsing to a module worker; retain the synchronous parser for environments without Worker support.
- [ ] 4.3 Verify query and final-render cost and optimise measured bottlenecks without broad unrelated storage changes.

## 5. Verification and documentation
- [x] 5.1 Add tests for overlapping reconciliation, stale-query replay, parser failure feedback and pending-result semantics.
- [x] 5.2 Test pending counts, duplicate batches, own actions, Show races, explicit refresh, preference transitions and reader return.
- [ ] 5.3 Verify actual chrome at 320/390/768/820/1440px, coarse touch, keyboard, reduced motion, text enlargement and one screen-reader announcement source.
- [ ] 5.4 Compare large-library measurements through final rendering and interaction; validate on a real mobile device and record remaining limitations.
- [x] 5.5 Update README for held arrivals and the local preference; run typecheck, lint, focused tests and build. Full-suite status is recorded in the task summary.
- [x] 5.6 Validate and archive the implemented change with its applied main specs; run the repository-pinned main spec validation. Parent verification passed all 57 specs with `npm_config_cache=/private/tmp/lidora-openspec-cache npm run spec:validate`. The separately installed global CLI treats existing length warnings more strictly; it reports the same 19 unrelated failures on main and this worktree.
