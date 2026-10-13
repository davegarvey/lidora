# Design

## Library

DOMPurify 3 is licensed under MPL-2.0 OR Apache-2.0. Either option permits use in an MIT-licensed project; Sift redistributes it unmodified in the bundle. It is already allowlist-based, maintained, and uses the browser's own parser, so parser differentials are limited.

## Allowlist

`src/articles/sanitise.ts` creates a dedicated DOMPurify instance and passes explicit `ALLOWED_TAGS` and `ALLOWED_ATTR` lists, replacing DOMPurify's defaults. Notable decisions:

- **Removed:** `script`, `style`, `form` and its controls, `object`, `svg`, `math`, `base`, `meta`, `link`, and every `on*` attribute. DOMPurify's URI check removes `javascript:` and other non-allowlisted schemes from `href` and `src`.
- **`id`, `class`, `name` and arbitrary `data-*`/`aria-*` attributes are removed.** `id` and `name` could clobber or collide with Sift's own DOM, and `class` could borrow Sift's styles (for example an overlay class) to imitate its interface. Sift's article CSS targets elements, not classes. In-page fragment links already resolve to the original page and open in a new tab, so dropping `id` loses no navigation. `data-original-src` is kept explicitly for hero matching.
- **`style` is kept only on `img`, `iframe`, `video` and `embed`.** These carry the inline styles written by `fitMediaElements` and hero injection. Elsewhere, inline styles could position content over the reader's controls.
- **Frames:** an `iframe` or `embed` whose `src` is not an absolute `http:` or `https:` URL is removed. This excludes same-origin and `data:` frames; `srcdoc` is never allowed. Cross-origin frames cannot reach Sift's storage, so they are not sandboxed further, which keeps video embeds working.
- **Links:** any element with `target` gets `target="_blank"` and `rel="noopener noreferrer"`, matching `processLinks`.

## Where it runs

- **Render:** `ReadingView` sanitises in a memo immediately before `innerHTML`. This is the guarantee, because it covers stored bodies from earlier versions, the excerpt fallback, and a fresh extraction returned before it is stored.
- **Write:** `bulkUpsertItems` sanitises feed HTML before opening its transaction, and `saveExtractedHtml` sanitises Readability output. This keeps stored data clean, including bodies that later reach other code. Sanitising each feed item costs a DOM parse per refresh; typical batches are tens of items, so the work stays well below a long task.

The sanitiser throws when no DOM is available instead of returning its input, because DOMPurify returns input unchanged in that case. All callers run in the page. Tests that store bodies now run under jsdom.

## Existing data

Stored bodies are not rewritten. The render-time pass covers them, and feed bodies are replaced with sanitised copies on the next refresh.
