## Why
Dates between 7 and 59 days old are all labelled "last month", whatever the calendar month: an article published 8 days ago in the same month reads as last month. The rounding also makes the "N months ago" label unreachable. Readers also cannot see the exact publication time.

## What Changes
- Keep relative wording for dates under a week old. Show older dates as day and month ("23 Oct"), adding the year when it differs from the current year.
- Render the reader byline date as a `<time>` element with a machine-readable `datetime` and a full local date and time in `title`.

## Capabilities
### Modified Capabilities
- `relative-time`: Human relative times switch to absolute dates after a week; the reader byline exposes the exact timestamp.

## Impact
`src/util/time.ts`, the reading view byline and unit tests. Settings and feed-editor labels pick up the corrected formatter without markup changes. No storage, sync or server change.
