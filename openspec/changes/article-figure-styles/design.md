# Design

The rules sit with the other `.reading-body` element styles in `src/styles.css` and use existing theme tokens, so Latte and Mocha are covered without per-theme rules:

- `figure`: `margin: 1.5em 0`.
- `figure img`: `margin: 0 auto`. The general `img` rule already sets `max-width: 100%; height: auto`. Its `1em auto` margin would otherwise collapse with the caption's top margin and set the image–caption gap to 1em.
- `figcaption`: `--sans-stack`, `0.8em`, `line-height: 1.5`, `--subtext`, `margin-top: 0.6em`.

The mobile-only `figure { margin-inline: 0 }` rule is removed because the general rule supersedes it.

No rule targets `strong` inside figures. Nothing in the stylesheet resets `strong` or `b` weight inside the reading body, so a bold figure title keeps the browser's bold weight.

Figure images are not forced to full width. `width: 100%` would enlarge small images, such as icons, and blur them. An image narrower than the column, including an SVG with a small intrinsic size, renders at its natural width; publishers control that size with the SVG's `width`/`height` or the `<img>` attributes.
