# Proposal

## Why

The sidebar chip row now mixes two kinds of control. `all` and the tags choose which feeds are in scope; Starred, Unread and For you change how that scope is shown. The For you chip is labelled text, so it reads as a tag, and it can be highlighted at the same time as `all` in a row that otherwise means "which subset". When there are enough tags to wrap, the three toggles can fall onto a line between tags, so no divider or ordering inside the row keeps them visibly separate. For you is also an order rather than a filter, which a chip among filters misrepresents.

The reading pane already owns a quiet 40px chrome bar for actions on the open article. Giving the article list a matching header lets each pane own its controls: the sidebar chooses scope, the list header holds list-level toggles, and the reading chrome holds article actions.

## What Changes

- Add a quiet header to the article list. It names the current scope and holds the Starred, Unread and For you toggles as separate icon buttons.
- On desktop the header is sticky and aligns with the reading pane chrome in the three-pane layout. On mobile it sits at the top of the list below the existing top bar and scrolls away with the list, so the fixed chrome does not grow.
- For you becomes an icon toggle (Lucide `ArrowDownWideNarrow`) whose accessible name and tooltip state the current order. It no longer uses the Sparkles icon or a text chip.
- Remove Starred, Unread and For you from the sidebar chip row and from the collapsed desktop rail. The chip row holds only `all` and the tags.
- Replace the "no persistent row above the article list" requirement with the header requirement.

## Capabilities

### New Capabilities

- `river-list-header`: The article-list header, its scope title, layout behaviour and toggle placement.

### Modified Capabilities

- `for-you-article-order`: The ordering control moves from the sidebar chips to the list header and becomes an icon toggle.
- `unread-article-filter`: The Unread toggle moves from the sidebar chips and collapsed rail to the list header.
- `starred-filter`: The Starred toggle moves from the sidebar and collapsed rail to the list header.
- `ui/sidebar-empty-state`: The hidden chip row no longer includes Starred.

## Impact

`River.tsx`, `Sidebar.tsx`, the mobile list layout in `styles.css`, and the related tests and specs. No state, storage, query or sync behaviour changes: the toggles call the existing actions. The README describes For you and should be checked for control placement when implementation lands.
