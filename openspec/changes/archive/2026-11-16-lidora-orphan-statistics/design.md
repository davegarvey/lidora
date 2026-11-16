# Design

Feed statistics are keyed by feed ID and intentionally outlive subscriptions. `unsubscribeFeed` deletes the feed and its article records but leaves its statistics so a later subscription can reuse that history. The transfer validator must not apply a foreign-key constraint to this store. Keep relation checks for articles, bodies, flags, and read markers, which must refer to a current feed and article.

The library merge already remaps statistics when their source feed is present and preserves an otherwise-unmatched statistics row by its stored feed ID. No schema or merge policy change is needed.
