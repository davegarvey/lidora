# Design

`.river-inner` becomes a flex column that grows to the river's height; `.empty-state` takes `flex: 1` so its existing centring applies.

The welcome renders a `.welcome` block: a headline, one paragraph of copy, a `<ul>` of three action buttons, a pairing line and a footer. Each action is a full-width row button with a 16 px Lucide icon, a label and a muted note. Add a feed uses the accent colour for its icon and label; the others are neutral, keeping Mauve to one element. Rows are separated by hairline borders rather than drawn as cards.

On desktop the column is at most 480 px wide and centred in the river. Below the mobile breakpoint the welcome becomes a flex column filling the river: the intro sits at the top with generous top padding and the action list and footer are pushed to the bottom with `margin-top: auto`. Rows keep at least a 44 px touch target. The notes hide on mobile to keep rows to one line.

The pairing line reads "Already use Lidora in another browser? Pair this one" and opens the devices section of Settings. The footer reuses features already stated on the About page (works offline, full articles, optional sync) and links to `/about`.
