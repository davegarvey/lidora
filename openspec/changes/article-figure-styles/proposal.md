# Article figure styles

## Why

The reading view has no rules for `figure` or `figcaption`. A chart's caption renders at body size, in the body serif and colour, so it reads as another paragraph. Desktop figures also keep the browser's default 40px side margins, which indent charts relative to the text.

## What Changes

- Give article figures vertical spacing and no horizontal margin at every viewport width, replacing the mobile-only margin reset.
- Centre images inside figures and scale them down to the reading column, without enlarging them beyond their natural size.
- Render `figcaption` in the interface sans-serif, smaller than body text, in the muted text colour, with modest spacing above.
- Style standard elements only. Site-specific classes such as `figure-title` are not targeted, and Readability strips classes during extraction in any case.
