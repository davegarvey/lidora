# Design

## Context

The expanded sidebar renders `all`, For you, Starred, Unread and the tags in one wrapping chip row. The collapsed desktop rail repeats Starred, For you and Unread. On desktop the article list has no chrome above it; on mobile a fixed 40px (44px on touch) top bar holds the sidebar toggle, wordmark and pending-update status. The reading pane has a sticky 40px chrome bar with article actions on the right; in the three-pane layout it uses the base background and shows its border only once scrolled.

The three toggles do not share one rule. Starred and Unread narrow the list, and Unread is disabled while Starred is active. For you reorders whatever the other two allow and composes with both. They are independent toggles, not one choice.

## Goals / Non-Goals

**Goals:**

- Separate scope controls from view controls in a way that survives any number of tags.
- Keep the toggles reachable without opening the sidebar on any layout.
- Match the existing reading chrome so the panes read as one system.

**Non-Goals:**

- Changing filter, ordering, query or persistence behaviour.
- Adding counts, sort menus or further list options to the header.
- Changing the reading pane chrome or the mobile reading bottom bar.

## Decisions

### Pane-owned controls

The sidebar chooses scope, the list header holds list-level toggles and the reading chrome holds article actions. The header holds only the three toggles and a scope title. Keeping the toggles in the sidebar as a non-wrapping cluster was considered; it fixes wrapping but leaves view controls in the scope area and still requires the drawer on mobile.

### Header layout

The header is 40px high, matching the reading chrome inner height, with the scope title on the left and the toggles on the right. It uses the list background with no bottom border until the list has scrolled, as the reading chrome does in the three-pane layout. On desktop it is sticky at the top of the list pane. It is shown in the river view only, not in the stats or settings views, and not in the zero-feed welcome state.

### Scope title

The title is `All` when no feed or tag is selected, the feed title when a feed is selected, and the selected tag names joined with commas when tags are active. It truncates with an ellipsis. It adds no data the app does not already hold.

### Separate icon buttons

The toggles are separate square icon buttons with their own pressed states, not a joined segmented control, because a joined control suggests a single choice. Starred uses the existing filled/outline `Star` treatment, Unread uses `CircleDot` and For you uses `ArrowDownWideNarrow`. Sparkles is dropped because it implies an opaque AI feature, while the ranking is a transparent heuristic. Mauve remains reserved for the active state, as for the current chips.

### Mobile placement

On mobile the header is the first element inside the scrolling list, below the fixed top bar, and scrolls away with the list. Placing the toggles in the fixed top bar was considered; it would crowd the pending-update status on narrow screens. A second fixed bar was rejected because it would double the permanent chrome.

### One home per control

The toggles leave the sidebar chip row, the mobile drawer and the collapsed desktop rail. A collapsed sidebar no longer hides them, because the header is always visible beside the list. In desktop focus mode the list is hidden, so its toggles are hidden with it.

## Risks / Trade-offs

- The list loses 40px of vertical space on desktop. Mitigation: the header carries a title the list did not previously show, and has no border until scrolled.
- In the three-pane layout two star icons sit side by side: show starred in the list header and star this article in the reading chrome. Mitigation: distinct accessible names and tooltips, and the filter's pressed state. If testing shows confusion, Lucide `Stars` can replace the filter icon.
- Readers used to the sidebar toggles must find them in a new place. The move is small and visible, so no migration aid is planned.
