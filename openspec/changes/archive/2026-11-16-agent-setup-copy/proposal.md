# Agent setup copy

## Why

Connecting an agent copies setup instructions to the clipboard without being asked, and the panel's note tells the user what will happen next ("then tap Allow"). Lidora cannot know that: coding agents configure themselves, while chat apps such as Claude and ChatGPT send the user to a connector setting, and each client's flow changes over time. The agent reading the instructions is best placed to explain its own flow, so the page should hand over the instructions and state only what Lidora controls.

Automatic copying also overwrites the clipboard unasked and can fail silently, because the write happens after a network request rather than directly on a click.

## What changes

- Connect an agent no longer writes to the clipboard. Copy setup instructions becomes the primary action, followed by the URL as a secondary copyable item for users who add it to a connector setting themselves.
- The panel's note states only where to paste the instructions and when the link expires.
- The setup instructions stop predicting the user's sign-in steps and ask agents that cannot change their own configuration to repeat the URL alongside their directions.

## Impact

Client-side copy and layout only. No server, storage or sync changes.
