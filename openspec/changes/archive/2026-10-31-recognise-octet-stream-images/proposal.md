# Recognise valid images served as generic binary data

## Why

Some public image hosts serve valid image files with `Content-Type: application/octet-stream`. Lidora currently rejects those responses, so article images such as the WebP charts in Google DeepMind's Gemini 4 Carbon post fail through `/img` even though the files are valid images.

## What Changes

- Inspect a small prefix of generic binary image responses and allow them only when their bytes match a supported image format.
- Return the detected image media type while preserving the existing size limit, streaming response, and image isolation headers.
- Continue rejecting generic binary data that does not have a recognized image signature.
