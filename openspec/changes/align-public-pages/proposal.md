## Why

The About entry in the sidebar is the only item that leaves the reader. It loads a separate static page with a full reload, and that page is styled as a different product: a sans wordmark, an Inter-first font stack, large landing-page headings and a top navigation bar the reader does not have. Its dark theme is also broken, because the light rules in `pages.css` follow the dark overrides and win: the "Just getting started?" card renders light with near-white text, and links use the Latte accent. The sidebar About link also renders in the primary text colour rather than the muted colour of its neighbours, because `.sidebar-link { color: inherit }` overrides `.sidebar-action`.

People already using the reader need About only occasionally; visitors and crawlers need it as a public page. The root must stay the reader, since installed PWAs, pairing links and OAuth redirects depend on it, and the welcome screen already shows newcomers what Sift does.

## What Changes

- Remove About from the expanded sidebar and the collapsed rail. Link it from the Settings footer beside Privacy and Terms; the welcome screen keeps its About link.
- Restyle `/about`, `/privacy` and `/terms` with the reader's Catppuccin tokens for both themes, its italic serif wordmark, its system font stack for body text and the serif headings used by the Stats view. Replace the top navigation with the wordmark and an "Open reader" link; move page links to the footer.
- Rewrite the About page for search and for non-technical visitors: a plain headline, one line on what Sift does, a single "Open Sift" action, a short feature grid, and a self-hosting section that holds the GitHub link. Add `WebApplication` structured data and a descriptive title and meta description. Replace the reader's root description and the welcome copy with the same plain wording.
- Serve static fallback content in `index.html`: the wordmark, a one-sentence description and a link to `/about`. The reader clears it when it mounts, so it is visible only before the script runs and to crawlers that do not run JavaScript.
- Publish `sitemap.xml` listing the root and the three public pages, and reference it from `robots.txt`.

## Capabilities

### Modified Capabilities

- `sidebar-layout`: the sidebar no longer links to About.
- `public-site-pages`: pages share the reader's visual identity and both themes; Settings links to them; the reader shell carries crawlable fallback content and a sitemap.

## Impact

`public/pages.css`, `public/about.html`, `public/privacy.html`, `public/terms.html`, `public/robots.txt`, new `public/sitemap.xml`, `index.html`, `src/main.tsx`, `src/components/Sidebar.tsx`, `src/components/SettingsDrawer.tsx`, `src/components/River.tsx` and `src/styles.css`. No server, routing or service worker changes.

## Non-goals

A separate landing page at the root, moving the reader to another path, an in-app About modal, and following the in-app theme preference on the static pages.
