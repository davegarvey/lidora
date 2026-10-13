# Sanitise article HTML

## Why

The reading view assigns article HTML to `innerHTML`. That HTML comes from feeds or from Readability extractions of arbitrary pages, and neither path is sanitised. `innerHTML` does not run `<script>`, but it does run inline event handlers: Readability keeps `<img src=x onerror="…">`, for example. The app shell sends no `Content-Security-Policy`, so such a handler runs in Sift's origin, which holds the IndexedDB reading data and the sync key.

## What Changes

- Add an allowlist sanitiser, based on DOMPurify, for article HTML.
- Sanitise immediately before the reading view renders a body, so bodies stored by earlier versions are covered.
- Sanitise feed HTML in `bulkUpsertItems` and Readability output in `saveExtractedHtml`, so stored bodies are clean.
- Keep the markup the reader relies on: figures, pictures, proxied `/img?url=` images, text formatting, headings, lists, quotes, code, tables, links, and fitted media embeds.

## Out of scope

A `Content-Security-Policy` for the app shell. It would add a second barrier against inline script, but needs a policy across the Workers asset handler, the Node and Bun adapters and the Vite dev server, and must allow remote feed images and embeds. It is left for a separate change.
