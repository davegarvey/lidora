# Resolve images in feed-provided article content

## Why

Full article HTML from Atom feeds can contain relative image URLs and an `xml:base` that tells readers how to resolve them. Sift stores the HTML but drops that base, then renders it under the reader's origin. The browser consequently requests images from the wrong host and shows a broken image.

## What changes

- Preserve the effective base URI with cached feed-provided article HTML, including inherited `xml:base` values.
- Resolve image `src` and responsive image candidates against that base and route remote HTTP(S) images through Sift's image proxy before rendering.
- Use the same image preparation behavior for feed-provided and extracted article HTML.

## Impact

Article bodies with relative images will resolve to their publisher's resources. Remote images continue to use the existing image proxy, cache, and response restrictions. This adds optional body metadata and does not require an IndexedDB version upgrade.
