# Bundle the serif font

## Why

The serif font stack begins with Charter, which ships with macOS and iOS but not with Windows or Android. On those platforms the wordmark, article text, article titles and statistics headings render in Georgia or the default serif, so the product's typography and brand differ by device.

## What Changes

- Bundle XCharter, an extension of Bitstream's freely licensed Charter, as four Latin-subset WOFF2 files (regular, italic, bold, bold italic; about 143 KB in total), served from `public/fonts/` with the Bitstream notice.
- Put "XCharter" first in the serif stack in the app, the static pages and the boot screen, keeping the existing fallbacks.
- The service worker already precaches `.woff2` files, so the fonts are available offline after the first visit.
- Characters outside the Latin subset, such as Greek and Cyrillic, continue to use the fallback fonts.
