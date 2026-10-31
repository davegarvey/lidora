## Why
Cloudflare analytics for 24–31 October 2026 show that the Worker's CPU time and D1 load come from avoidable repeated work rather than from user traffic. Minutes in which the 10-minute polling cron ran used 368 s of CPU over four days, against 24 s for all other minutes. Of the 64 polled feeds, 12 send no `ETag` or `Last-Modified`, so every poll downloads and fully parses them even when nothing has changed; only 406 items were new in the last 24 hours. Separately, `sift-sync` received 265,540 read queries in a week, about 35 per Worker request, because the Worker builds a new Hono app per request and the OAuth, MCP and sync routes cache their schema check on that app instance.

## What Changes
- Record a SHA-256 hash of each successfully stored feed body in `polled_feeds` and treat a matching body as unchanged: no parse and no item writes.
- Run each D1 schema check at most once per database per process, and build the Worker's Hono app once per environment rather than per request.
- Stop parsing every feed a second time to find `xml:base`; read it only when the document contains `xml:base`.

## Capabilities
### Modified Capabilities
- `server-feed-polling`: Unchanged feed bodies are recognised without parsing.
- `codebase-cleanup`: Schema initialisation runs once per database per process.
