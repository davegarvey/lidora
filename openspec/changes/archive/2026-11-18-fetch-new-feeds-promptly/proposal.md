# Fetch new feeds promptly

## Why

A feed that reaches a browser without items sits on "No items yet." for several minutes. This happens to feeds added by an agent through MCP, added on another device, or added as sample feeds. The Add feed dialog is unaffected because it stores the items it fetched for its preview.

Three things combine:

- The scheduler treats a feed that has never been fetched as due at scheduler start plus its stable jitter, up to 15 minutes, and checks only every 5 minutes. A feed arriving through a sync pull therefore waits for a tick.
- The river cannot tell a feed that has never been fetched from one that was fetched and is empty, so it shows "No items yet." and a "Check for new items" link.
- That link does not show that it was activated. A manual refresh pulls sync state before it fetches feeds, so for a few seconds nothing on screen changes, and a second click joins the running refresh. The `refresh-feedback` spec already requires the empty-state action to become disabled at once; the link does not.

## What changes

- A feed that has never been fetched and has no pending retry is due immediately, without jitter. When a sync pull or a subscription adds such a feed, the client fetches it straight away rather than at the next tick.
- When every feed in the river's selection is still awaiting its first fetch, the river shows "Fetching <feed>…" instead of the empty state. If that first fetch fails, the river shows the error and a "Try again" action.
- The empty-state "Check for new items" action becomes a button that is disabled and reads "Checking…" while a manual refresh runs, as `refresh-feedback` requires.

The MCP `subscribe` tool is unchanged. Storing the items it reads during discovery would not make them appear sooner, because a browser learns of the new feed on its next sync pull and now fetches it at once.

## Impact

Client only: `src/feeds/scheduler.ts`, `src/state.tsx` and `src/components/River.tsx`. A pull that adds many feeds at once fetches them immediately, bounded by the existing concurrency of four and the server's origin governor; pairing and OPML import already did this. No storage, sync protocol or server changes.
