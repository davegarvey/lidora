# Show pending updates in the list header

Place the pending Show action in the article list header, next to the list it changes.

## Why

Library activity is global system state, so its icon belongs in the main navigation. The Show action is different: it publishes held changes to the visible article list. Placing it in the sidebar header or mobile top bar separated it from that list, and when the desktop navigation was collapsed it had no location while reading.

## What changes

- The pending Show action appears in the article list header, between the list title and its toggles, in every layout where the list is visible.
- The sidebar header and mobile top bar keep the activity icon only.

## Non-goals

- Changing when updates are held, how the action is labelled or what it publishes.
