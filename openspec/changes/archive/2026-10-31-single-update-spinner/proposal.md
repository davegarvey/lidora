## Why
The Updating icon is static while the manual refresh action and individual feed rows animate. Animating all three would make a quiet reader unnecessarily busy. Use one recognisable activity indicator for the complete update lifecycle.

## What Changes
- Animate a single neutral Lucide spinner in existing chrome, without visible Updating text.
- Use mobile top-bar activity for the list, desktop sidebar-header activity for the list, and reader-header activity while reading. Suppress duplicate sidebar activity when the reader is open. Reuse the collapsed rail's brand slot rather than adding a row.
- Keep refresh actions still and immediately disabled during manual refresh. Remove routine per-feed spinners; preserve error indicators and feed-fetch state used by loading decisions.
- Keep Show actions underlined and still, the existing activity delay/lifecycle, and a descriptive accessible Updating articles label. Disable rotation under reduced motion.

## Capabilities
### Modified Capabilities
- `library-updates`: One icon-only animated activity cue in visible existing chrome.
- `refresh-feedback`: Immediate still-button acknowledgement through disabled state, with shared header activity.
- `reader-ui`: Remove per-feed fetching indicators.
- `sidebar-layout`: Refresh action remains still while disabled.

## Impact
Client components and CSS, focused browser regression coverage, README and applied OpenSpec specifications. No storage, sync, update-gating, settings or release-version change.
