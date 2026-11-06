# Quiet welcome screen

Give the zero-feed river a calm first screen that fills the space, says what Lidora is and tells each kind of visitor where to start.

## Why

On desktop the welcome sits at the top of the river because its container does not fill the river's height, so the centring in `.empty-state` has no effect. The four actions are equal-weight buttons that wrap unevenly and do not say who each one is for: new readers want to add a feed or try samples, people moving from another reader want OPML, and returning readers on a new device want pairing.

## What changes

- The river's inner container fills the river height, so every empty state (welcome, no starred items, caught up, no items) centres vertically.
- The welcome uses a left-aligned column with a short headline, one sentence on local storage, and three ways to start (add a feed, try samples, import OPML) as rows with a short note on when each applies.
- Pairing moves out of the main actions into one line for people who already use Lidora in another browser, since a first-time visitor has nothing to pair with.
- A muted footer line names a few features and links to About.
- On mobile the headline sits near the top and the action rows sit at the bottom of the screen, within thumb reach.

## Non-goals

- Changing what the actions do or which sample feeds are offered.
- Changing the other empty states beyond their vertical centring.
