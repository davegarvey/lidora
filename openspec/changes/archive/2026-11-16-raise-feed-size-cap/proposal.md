# Raise the feed size cap

## Why

The `/feed` proxy rejects feeds larger than 2 MiB. Some active feeds now exceed that because they carry full article bodies: PostHog's blog feed (`https://posthog.com/rss.xml`) is 3.3 MB with 258 items. Subscribing succeeds, because discovery reads with the 5 MiB article cap, but every refresh and every server-side poll then fails with `502`, so the subscription never shows an item.

## What changes

- Raise the `/feed` body cap, and the matching feed cache limit, from 2 MiB to 8 MiB. This leaves room for such feeds to grow while still bounding a single response.
- Bound the process-local memory feed cache by total body size (32 MiB) as well as by entry count (256). With an 8 MiB per-entry limit the count bound alone would allow 2 GiB, well beyond a Worker isolate's memory.

## Impact

Server only. Large feeds use more proxy bandwidth and more browser parsing work per refresh; typical feeds are unaffected. The Workers Cache API entries can now be up to 8 MiB each. No storage, sync or client changes.
