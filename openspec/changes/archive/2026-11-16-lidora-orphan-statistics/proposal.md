# Preserve statistics for unsubscribed feeds during migration

## Why

Unsubscribing removes a feed and its articles but intentionally retains its feed statistics, so resubscribing can restore its reading history. The Lidora library transfer currently rejects those valid rows as inconsistent and aborts the move.

## What changes

- Treat feed statistics as durable records that may exist without a current subscription during backup, restore, and cross-origin transfer.
- Keep the stricter subscription relationship checks for articles and article state.

## Impact

This is a local browser-library transfer behavior change. It does not change the stored schema or server sync format.
