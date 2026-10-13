## 1. Sanitiser

- [x] 1.1 Add DOMPurify and confirm its licence is compatible with MIT.
- [x] 1.2 Add `sanitiseArticleHtml` with an explicit tag and attribute allowlist, media-only inline styles, remote-only frames and opener-safe link targets.
- [x] 1.3 Unit-test handler, script, style and `javascript:` removal, and preservation of figure, picture, proxied image, text, table and fitted embed markup.

## 2. Integration

- [x] 2.1 Sanitise in the reading view immediately before rendering the body.
- [x] 2.2 Sanitise feed HTML in `bulkUpsertItems` and extracted HTML in `saveExtractedHtml`.
- [x] 2.3 Test the render sink and both write paths; run body-storing tests under jsdom.

## 3. Verification

- [x] 3.1 Run typecheck, lint, tests and `openspec validate sanitise-article-html --strict`.
- [x] 3.2 Check the sanitiser in a real browser through the dev server.
