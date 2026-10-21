# Design: Resolve images in feed-provided article content

## Preserve the XML base

`parseFeed` receives the fetched feed URL as its document base. For each entry's selected full-content element, determine the effective base URI using XML Base inheritance from the feed root through the entry and content element. Resolve relative `xml:base` values against their parent base. Store that effective content base beside the body in `itemBodies`; it is optional metadata and does not change the IndexedDB store layout.

If the selected content does not declare an `xml:base`, use the effective XML document base. Do not assume the item's alternate article link overrides a base declared by the feed.

## Prepare media for the reader

Before returning full feed HTML from `openItemForReading`, process `img[src]`, each URL candidate in `img[srcset]`, and `source[srcset]` inside `picture`. Resolve candidates against the content base when they are not already absolute, keep only HTTP(S) image URLs, and rewrite remote candidates to the same-origin `/img?url=` proxy. Apply this to old stored feed HTML too, using the item link as a fallback base when no content base was retained by an older client.

Extracted article HTML already contains proxy URLs. The shared media preparation step must recognize and leave those URLs unchanged, so both paths can use it safely. Sanitization remains in place before storage and immediately before rendering.

## Safety and compatibility

Use URL parsing and a srcset-aware parser rather than rewriting HTML with regular expressions. Do not fetch image bytes during parsing or opening; the browser fetches them from the existing proxy when it renders the article. Leave malformed and non-HTTP(S) candidates out of the rendered source sets.
