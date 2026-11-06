## Design
`humanRelativeTime` keeps its existing buckets up to six days and replaces the month buckets with an absolute day-and-month label using fixed English month abbreviations, matching the existing output style. It takes an optional `now` so tests are deterministic.

`fullTimestamp` uses the browser locale (`dateStyle: 'full'`, `timeStyle: 'short'`) because the tooltip is for exact reading rather than layout. Only the reader byline gets the `<time>` element: the settings and feed-editor call sites compose plain-string labels, and absolute dates after a week already remove the ambiguity there. Hover tooltips are unavailable on touch, so the absolute label, not the tooltip, carries the date.
