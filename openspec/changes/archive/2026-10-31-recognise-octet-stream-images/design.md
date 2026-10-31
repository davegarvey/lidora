# Design

The image proxy already accepts responses labeled `image/*`, but Google Cloud Storage serves this article's WebP charts as `application/octet-stream`. The image fetch succeeds upstream, then `/img` returns 502 because it trusts the header alone.

For `application/octet-stream` only, read enough of the response stream to inspect its file signature. Recognize common raster formats, then prepend the inspected chunks back to the stream and continue using the existing 10 MiB body cap. Set the response type from the detected format. Keep accepting declared `image/*` types as before and reject all other generic binary data.

This preserves streaming and avoids buffering the full image. It also avoids treating every generic binary response as an image, which would weaken the proxy's current content-type check.
