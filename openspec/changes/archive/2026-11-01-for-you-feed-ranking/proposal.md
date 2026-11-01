# Proposal

## Why

Chronological lists let high-volume feeds occupy much of the visible river, even when the reader tends to read more from a quieter source. Lidora already retains first-seen article dates and once-read markers, which can support a recent, feed-relative reading signal without collecting a detailed activity log.

## What Changes

- Add an optional For you ordering that ranks articles within the reader's current feed, tag, read and starred scope; Latest remains the default chronological order.
- Balance recent feed read-through and article recency so a prolific feed does not crowd out a less frequent feed the reader tends to read.
- Add compact thumb up and thumb down controls in the existing article action areas. A vote made from an article expresses a feed-level preference, clearly labelled More from [feed] or Less from [feed].
- Keep the controls quiet, keyboard and touch accessible, and available while browsing the article list and reading an article.
- Derive recent feed signals from existing local article and once-read records. Do not add impression tracking or a detailed reading event log.
- Keep the For you choice and direct feed preferences local to the device in this first version.

## Capabilities

### New Capabilities

- `for-you-article-order`: Optional feed-aware article ordering and direct feed-level preference controls.

### Modified Capabilities

- `unread-article-filter`: Article ordering and reading navigation follow the selected Latest or For you order while preserving the current eligibility scope.
- `item-body-storage`: The IndexedDB current version and item indexes advance to support bounded recent-cohort queries.
- `storage-retention`: The item timestamp migration scenario follows the current database-version upgrade path.

## Impact

The article list, reading pane, application state and settings, IndexedDB item queries, and relevant OpenSpec contracts. The change may add a bounded recent-item query index; it does not change sync APIs or add server-side analytics. Update the README when implementation lands.
