## Design
Use a shared LibraryActivity component for the neutral Lucide LoaderCircle, accessible as Updating articles. It contains no visible text or action. Rotate only this component and honour prefers-reduced-motion. Keep the existing 300 ms activity delay and minimum dwell.

The responsive shell already controls which headers are visible. Mobile lists use TopBar, desktop lists use the expanded sidebar header or collapsed brand slot. While reading, omit activity from the sidebar and use the reader header, including focus mode and an open navigation drawer. A header activity icon may coexist with a still Show action. The collapsed brand slot keeps its existing dimensions and expansion hit area.

Refresh remains a Lucide RefreshCw icon and never rotates. Disable it as soon as a manual refresh is enqueued, including keyboard requests and queued refreshes, rather than waiting for its promise callback to start. Preserve the existing refresh coalescing and full-operation error cleanup. Use aria-busy plus the existing accessible scope/action labels to acknowledge the operation; do not let background work disable manual refresh.

Remove the per-feed fetching view only. Keep per-feed state in the scheduler/context because River uses it to decide loading versus empty. Preserve actionable failure indicators.

## Validation
Run typecheck, lint, unit tests, production build and strict OpenSpec validation. Add a browser regression that exercises real delayed refreshes, checks a single visible animated cue across desktop/mobile, expanded/collapsed navigation, reader/focus/drawer states and resize, verifies no visible Updating text or per-feed animation, and checks reduced motion and still enabled/disabled refresh actions. Run the existing smoke suite. No real-phone or screen-reader claim is made by these automated checks.
