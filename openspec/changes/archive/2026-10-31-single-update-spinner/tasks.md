## Implementation
- [x] Add one shared accessible icon-only activity component and animation with reduced-motion support.
- [x] Route activity to one visible header across list/reader/mobile/desktop and reuse the collapsed brand slot without a new row.
- [x] Remove refresh-button and per-feed spinners; preserve immediate manual feedback, error indicators and internal feed state.
- [x] Update README and relevant OpenSpec deltas.

## Validation
- [x] Verify still refresh actions and the single activity cue in real-browser responsive, concurrent-pending and reduced-motion cases.
- [x] Run typecheck, lint, unit tests, production build and smoke tests.
- [x] Validate and archive the change with applied main specs, then run repository-pinned spec validation.
