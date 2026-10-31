# Validation

Implemented directly, without delegation.

- Typecheck, lint, production build, all 57 main specs and 831 unit/integration tests passed. Tests used `NODE_OPTIONS=--no-experimental-webstorage` on local Node 24 to avoid its experimental global web-storage interference.
- A new browser regression holds a real manual feed request open and verifies immediate disabled/busy feedback, a still refresh icon, and exactly one accessible Updating articles icon at 320, 390, 768, 769, 819, 820 and 1440px. It verifies rotation by observing the SVG transform change, not merely the icon's presence.
- The same regression covers collapsed navigation, mobile/desktop drawers, reading, focus mode and responsive transitions. Reduced motion removes rotation while preserving the accessible label.
- A second browser regression delivers a background article, starts another delayed background operation, and checks that Show remains still and clickable beside the spinner at 320px. Selecting Show reveals stored articles without ending the outstanding operation's activity cue.
- Per-feed fetching state and error feedback remain intact; only routine row indicators were removed. Refresh coalescing is covered by a provider test asserting synchronous busy feedback and one manual operation for repeated triggers.

An initial full smoke run used a fixture with numeric-only GUIDs that did not match the locally seeded article IDs. Stable string GUIDs corrected the fixture; both new tests pass. A later service-worker smoke test timed out while another build wrote the same dist directory and passed on retry. The final standalone smoke run passed all 14 tests with no retries (33.3 seconds).

These are local Chromium automated checks, not physical-device or manual screen-reader validation. No deployment or merge is part of this implementation step.
