## Why

Background refresh, sync and resume can replace the article list without the manual refresh indicator being active. Large feeds also require client-side parsing, HTML sanitisation, storage and queries before the visible update. Readers cannot reliably tell when the list has settled, and arriving articles can disturb their place.

## What Changes

- Add Header whisper: neutral activity feedback in existing app chrome, covering the full operation through list reconciliation and a rendering opportunity. Add no row, overlay, completion toast or Mauve activity accent.
- Default to holding background list membership and order stable once articles are displayed. Offer an explicitly actionable, underlined `Show N new` button, or `Show updates` for other deferred list changes.
- Apply updates automatically on explicit refresh, a new feed/filter selection, startup and an empty list. Explicit refresh preserves the current article anchor where possible; choosing Show reveals the latest list from the top.
- Add one local, persistent `Automatically show new articles` switch, off by default, for readers who prefer automatic background updates.
- Preserve the open article, local read/star actions, keyboard focus and touch scrolling. Make reconciliation awaitable and revision-aware so overlapping work cannot announce completion prematurely or lose a newer update.
- Measure and reduce long synchronous processing in large-library paths; verify responsiveness and final rendering on mobile as well as desktop.

## Capabilities

### New Capabilities
- `library-updates`: Complete activity lifecycle, stable list presentation, pending update actions, existing-chrome placement and large-library responsiveness.

### Modified Capabilities
- `event-driven-refresh`: Reconcile background changes without necessarily publishing list changes; drain overlapping invalidations.
- `refresh-feedback`: Keep immediate manual acknowledgement while extending completion through processing and visible reconciliation.
- `settings-page`: Add the local automatic-arrival preference in Appearance.

## Impact

Client state, scheduler and sync callbacks, database ingestion/query paths, reader return behaviour, existing headers/rail, settings and related tests. No server API, polling cadence, retention policy or sync protocol change. No app version bump. README feature and limitation text must be updated with implementation. This is a proposal; implementation tasks remain unchecked and the change remains active until implemented and archived in the implementing PR.
