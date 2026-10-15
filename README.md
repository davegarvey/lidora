# Lidora

A simple, browser-first RSS reader. Feed parsing, item storage, and reading
state run in the browser tab; the server proxies network requests (CORS-safe),
uses short-lived feed caching and shared failure cooldown metadata to reduce
duplicate upstream requests, serves the static app shell, and optionally
provides multi-device sync and AI agent integration.

- **Local-only**: subscriptions, items, read/starred state, and lifetime reading statistics live in IndexedDB.
- **Multi-device sync**: optional D1-backed sync via Cloudflare Workers (pairing-code based), including exact group read-once deduplication and approximate observed volume. You can delete your server-side sync data from Settings → Server data.
- **Server-side polling**: on Workers, synced subscriptions are polled every 30 minutes, so items published while no device is open still arrive.
- **AI agent connector**: a remote MCP server with OAuth lets chat and coding agents read subscriptions, statistics and recent articles, and manage subscriptions, after one approval. An OpenAPI document describes the sync API for other tools.
- **Portable**: export/import subscriptions as OPML, or create a full-library backup for recovery.
- **Offline**: installable PWA; works offline against cached data.
- **Deploy anywhere**: local dev, Node/Bun server, Docker, or Cloudflare Workers — all from one codebase.
- **Unread filter**: switch between Unread and All within the selected feed or tags. The choice is remembered on each device; Starred shows both read and unread saved articles.
- **Full-text**: summary-only feeds get full-text extraction via Readability.
- **Sanitised articles**: feed and extracted article HTML passes through an allowlist sanitiser (DOMPurify) before it is stored and again before it is displayed. Scripts, styles, forms, event handlers, `javascript:` links and same-origin frames are removed; images, figures, tables, links and media embeds are kept.

Learn more about [Lidora](https://lidora.app/about), including its [privacy policy](https://lidora.app/privacy) and [terms](https://lidora.app/terms).

## Develop

```sh
npm install
npm run dev          # http://localhost:8787
```

## Build & run

```sh
npm run build       # outputs to dist/
npm start           # node + tsx serving dist/, proxy, and API routes
# or:
bun server/bun.ts   # bun runtime
```

Node and Bun can store sync data in local SQLite files when `LIDORA_DATA_DIR` is
set. Node requires 22.13 or later for `node:sqlite`; Bun requires 1.3 or later. The sync and polling
databases are separate files; both runtimes apply the shared SQL migrations at
startup. Set `FEED_POLLING=true` to enable polling and daily maintenance.
Self-hosted SQLite supports one running Lidora server process per data directory;
it is not a shared database for horizontal scaling.

## Deploy

### Cloudflare Workers

```sh
npm run deploy    # pull + build + apply sift-sync and sift-poll migrations + deploy
```

Migrations are applied as part of the deploy, immediately before the
Worker ships. Workers Builds uses `npm run deploy:ci` (same sequence,
no `git pull`) as its deploy command.

Polling uses a separate D1 database named `sift-poll`, bound as `POLL_DB`, so
its item store cannot fill the sync database. Create and bind it once before
deploying:

```sh
npx wrangler d1 create sift-poll
```

Copy the returned database ID into the `POLL_DB` entry in `wrangler.toml`.
Polling runs only when `FEED_POLLING = "true"` and the binding is present.
The Worker checks for due feeds every 10 minutes; each feed is normally
scheduled every 30 minutes. The default batch is 50 feeds per run, enough for
about 150 distinct feeds at that interval. A full batch measured about 255 D1
queries and 555 subrequests, within Workers Paid limits but above the Free
plan's 50 subrequests per invocation. Remove `FEED_POLLING` to disable polling;
browsers continue fetching feeds either way.

The upstream User-Agent identifies the current Lidora package version and links
to the public About page.

Two Workers rate limiting bindings, `PROXY_FETCH_LIMITER` and
`PROXY_IMAGE_LIMITER`, enforce the per-client proxy limits described under
[Proxy limits](#proxy-limits). They are declared in `wrangler.toml` and need
Wrangler 4.36 or later. Their `namespace_id` values (`7301` and `7302`) must be
unique within your Cloudflare account; change them if your account already uses
those IDs. Without the bindings the Worker falls back to a per-isolate limiter,
which is less accurate but keeps the proxy working.

Set a billing alert in the Cloudflare dashboard (Billing, Notifications) for
Workers usage. A per-address limit bounds one source but not many, and an
alert is the quickest way to notice a public instance being used as a general
fetcher.

### Docker

```sh
docker build -t lidora .
docker run -p 8787:8787 lidora
```

For a persistent instance, mount `/data`. The GHCR image uses Bun and enables
sync by default; polling remains opt-in:

```sh
docker run -d --name lidora -p 8787:8787 -v sift-data:/data \
  -e FEED_POLLING=true ghcr.io/davegarvey/lidora:latest
```

Compose:

```yaml
services:
  lidora:
    image: ghcr.io/davegarvey/lidora:latest
    ports:
      - "8787:8787"
    volumes:
      - sift-data:/data
    environment:
      FEED_POLLING: "true"
volumes:
  sift-data:
```

## Moving from the previous hosted origin

The Lidora hosted origin has separate browser storage. On the previous hosted
site, open Settings → Storage and choose **Move to Lidora**. The transfer opens
Lidora in another tab and copies subscriptions, articles, saved article text,
reading and star state, preferences, statistics, sync credentials and pending
sync changes. Allow the new tab to open and keep both pages open until Lidora
confirms the library is saved. The old copy stays intact; if the transfer is
interrupted, return to the old page and retry. After verification, the old app
becomes read-only on that device. The old site must remain available for devices
that return later, including installed PWAs that were offline during cutover.
If the destination was paired to a different sync account, the source account
stays active; the destination account's credential and cursors are kept in local
recovery metadata and included in a full-library backup.

The transfer uses a browser-to-browser channel and does not send library data
through a server. A full-library JSON backup in Settings → Storage is a recovery
option; it can contain private feed URLs and sync keys. Restore it at
`https://lidora.app/migrate.html` and keep the file private. Because browser
storage and PWA installation are origin-specific, install Lidora again from
`lidora.app` after moving if you used the old site as an installed app.

## Rebrand upgrade notes

The application, package, MCP server and custom response headers now use the
Lidora identity. Custom headers use `X-Lidora-*`; integrations that inspect
`X-Sift-*` must update with the application. Self-hosted deployments must rename
`SIFT_DATA_DIR` to `LIDORA_DATA_DIR` and point it at the same existing directory.
Do not move or rename its files. Existing server data remains in `sift-sync.sqlite`
and `sift-poll.sqlite`; the Docker `/data` mount and the example `sift-data`
volume retain their names. The Vite development data directory also remains
`node_modules/.cache/sift`.

Cloudflare retains Worker `sift` and D1 databases `sift-sync` and `sift-poll`.
Both hosted domains are intended to use that same backend and polling schedule;
the domain and deployment cutover still requires an operator rollout. Existing
browser origins keep their `sift` IndexedDB database. The new `lidora.app`
origin uses `lidora`.

## Configuration

Copy `.env.example` to `.env` and set:

- `TRUST_PROXY_HOPS` — number of reverse proxies in front of Node or Bun whose `X-Forwarded-For` entry may identify the client for proxy limits (default 0, which ignores the header and uses the socket address)

OAuth on every deployment requires a persistent `BETTER_AUTH_SECRET` of at least 32 characters. Generate a random value (for example with `openssl rand -hex 32`) and keep it across restarts and replicas. Set it in the Node/Bun environment or pass it into Docker as an environment variable; on Workers, use `npx wrangler secret put BETTER_AUTH_SECRET`. Do not put it in `wrangler.toml`. Without it, OAuth returns 503 while device sync remains available.

For Node and Bun:

- `PUBLIC_URL` — public origin of the deployment (for example `https://lidora.example.com`); when set, it defines the OAuth issuer and resource URLs instead of the request origin, which matters behind a reverse proxy
- `LIDORA_DATA_DIR` — enable sync and store the `sift-sync.sqlite` and `sift-poll.sqlite` files in this directory
- `FEED_POLLING=true` — enable server-side polling when `LIDORA_DATA_DIR` is set; the process checks every 10 minutes
- `FEED_POLL_BATCH` and `POLL_DB_MAX_BYTES` — polling batch size and poll-database limit, with the same defaults as Workers

Cloudflare Workers variables (`wrangler.toml` `[vars]`):

- `PUBLIC_URL` — optional public origin used for OAuth issuer and resource URLs
- `FEED_POLLING=true` — poll synced subscriptions on the 10-minute cron and serve `/sync/items`
- `FEED_POLL_BATCH` — maximum feeds fetched per polling run (default 50, maximum 500)
- `POLL_DB_MAX_BYTES` — pause polling above this poll-database size in bytes (default 8 GiB)

Polling covers at most 500 feeds per account. Accounts with more feeds still
fetch the rest in their browsers. Daily maintenance rebuilds the URL registry
from accounts active in the last 14 days and deletes items older than 7 days.

### Proxy limits

`/feed`, `/article` and `/img` accept only requests from Lidora's own origin:
a request with a `Sec-Fetch-Site` header other than `same-origin` or `none`
receives `403`, so other websites cannot embed or call the proxy. Requests
without the header, such as `curl`, are not rejected on that basis.

Each client address is also limited to 2000 `/feed` and `/article` requests
and, separately, 600 `/img` requests in each 60-second window; the excess
receives `429` with `Retry-After`. The budgets allow a 1000-feed OPML import
plus a 500-feed refresh, or three articles of 200 images each, in one minute
from one household behind one address. Cache hits count. A limited request is rejected
before any target lookup, so it uses none of the per-origin budget.

On Workers the limit uses the Workers rate limiting binding, keyed by
`CF-Connecting-IP`, with no D1 writes. Cloudflare counts per location and
eventually consistently, so enforcement is approximate. Node and Bun, and
Workers without the binding, use a process-local limiter keyed by the socket
address; behind a reverse proxy or Docker network address translation, all
clients then share one budget unless `TRUST_PROXY_HOPS` is set. IPv6 clients
are keyed by /64 prefix.

`/feed` responses are capped at 2 MiB, `/article` at 5 MiB and `/img` at
10 MiB. A larger declared `Content-Length` returns `502`; a larger streamed
body is aborted at the cap, which the browser sees as a failed request.
Sync rate limits use Cloudflare's `CF-Connecting-IP`; `X-Forwarded-For` is
ignored because clients can supply it themselves.

## Scripts

- `npm run dev` — Vite dev server with HMR and the Hono proxy mounted as middleware
- `npm run build` — produce `dist/`
- `npm start` — run the production node server (serves `dist/`, proxy, API, and sync routes)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
- `npm test` — vitest unit/integration tests
- `npm run test:smoke` — Playwright smoke tests (requires `npm run dev`)
- `npm run test:conformance` — runs the official MCP conformance suite against a local Node server
  with a seeded test token (see `tests/conformance/`)
- `npm run spec:validate` — strict OpenSpec validation of `openspec/specs/` (runs in CI)
- `npm run deploy` — `git pull --ff-only && vite build && wrangler d1 migrations apply sift-sync --remote && wrangler d1 migrations apply sift-poll --remote && wrangler deploy`
- `npm run deploy:ci` — same, without `git pull` (Workers Builds deploy command)

## Privacy

The `/feed`, `/article`, and `/img` proxy endpoints forward your request to
the upstream URL and return the body. Only absolute HTTP(S) URLs whose literal
or resolved target passes the public-target safety checks are requested. Normal
public redirects are followed for up to five hops with each destination checked
again; unsafe, malformed, or excessive redirects return a generic upstream
failure and are not passed to the browser. Successful `/feed` responses are
held in a bounded cache keyed by the complete upstream URL, including responses
that set cookies (the proxy never forwards them). Each copy is fresh for the
longer of 15 minutes and the upstream's own hints (`Cache-Control`, `Expires`,
RSS `<ttl>`, `sy:updatePeriod`), capped at 24 hours, and is kept for a further
24 hours. While an upstream is rate limiting, challenging, timing out or
returning server errors, the proxy serves that retained copy with
`X-Lidora-Cache: stale` and `X-Lidora-Retry-After` instead of the failure, and the
browser does not flag the feed unless it has not been received for 24 hours.
Node/Bun use process-local memory; Cloudflare Workers also use the
Workers Cache API when available, with data-center-local, best-effort reuse.
Requests to the same origin are spaced at least one second apart and limited
to four in flight per runtime. Workers reserve those slots and share `429` and
`419` cooldowns through D1 using only a SHA-256 origin key; Node/Bun and local
development use process-local state. If D1 is unavailable, the Worker falls
back to its runtime-local gate. Queue waits are bounded and an overloaded
origin receives a local `429` with `Retry-After` instead of another upstream
request. Redirect destinations use the same policy. A valid upstream
`Retry-After` is honored without shortening it; absent `429` headers use a
30-minute fallback, while headerless `419` responses back off for 6, 12, then
24 hours. Other upstream errors use a 30-minute fallback capped at 24 hours.
All proxy errors are `no-store`; `/img` uses immutable caching only for
successful images. Every proxy response, including errors, carries a
sandboxing `Content-Security-Policy` and `X-Content-Type-Options: nosniff`, so
proxied content opened directly runs in an opaque origin without scripts and
cannot read Lidora's storage. Error responses are plain text and never forward
upstream headers, and `/img` refuses upstream responses that are not
`image/*`. Response headers identify whether a response came from the
upstream, a feed cache, a URL cooldown, an origin cooldown, or the local gate.

The feed body cache is not part of sync or persistent storage. Cloudflare
Workers store hashed feed failure keys and hashed origin reservation/cooldown
metadata in the sync D1 database; neither is exposed through the sync API.
Successful proxy bodies and validators use the existing cache layers, with
failure markers stored under separate keys. Diagnostics contain only a hashed
origin, route, status, retry timing, and a short allowlist of response
metadata. Same-site and per-client rejections are logged with only the route,
status and reason, never a client address or URL. The ordinary proxy does not persist upstream URLs, query strings,
response bodies, or article IDs. Worker cache hits still count as Worker
requests against the account plan limits. Target checks are application-level
filtering and do not pin a hostname to one DNS answer for the lifetime of a
connection.

When `FEED_POLLING=true`, the Worker polls each distinct feed URL subscribed
by a synced group that has pulled within the last 14 days, through the same
cache, cooldowns and request governor as `/feed`. It stores, per feed URL and
without any sync key, each new entry's title, link, author, date, excerpt,
thumbnail URL and feed HTML when that is at most 64 KiB, together with the
URL's validators and next poll time. Entries are deleted 7 days after they
were first seen, and polling state is deleted once no group subscribes to
the URL. `/sync/pull` records when a group was last active, at most once an
hour, whether or not polling is enabled; polling and account retention both
use it. Devices fetch these entries with `/sync/items` and keep only entries
they do not already hold. The full feed URL is stored in `POLL_DB`, including
any access token embedded in a private-feed URL. `/sync/items` returns entries
only to accounts that currently subscribe to that exact URL. Enable polling
only if you are comfortable storing those URLs and feed entries on the server.
If `FEED_POLLING` is not `true` or `POLL_DB` is not bound, the server stores
no polled feed entries.

For feed URLs, Lidora adopts a 301 or 308 destination after two independent
upstream fetches confirm the same validated URL. Temporary redirects do not
change subscriptions. A feed that returns 410 is marked removed in the reader
and is no longer refreshed automatically; server polling also stops for it.
The feed editor lets you unsubscribe or change its URL.

Sync data is kept until you delete it or the account expires. Settings →
Server data → Delete data from the server calls `DELETE /sync/account` (master key only), which in
one transaction deletes the account and every row keyed by its sync key:
subscriptions (including removed ones still awaiting cleanup), read and starred
flags, reading statistics, agent connections, pairing codes and the rate-limit
counters for that key. Agent connections and pairing codes stop working at once.
Data on your devices is not touched, other paired devices stop syncing, and
when polling is enabled any polled feed URLs and entries that no other group
subscribes to are deleted immediately (otherwise by the next daily pass).
Disabling sync does not delete anything: the key leaves the device but the
data stays on the server, so delete it first. The daily cron also deletes, with
all their rows, accounts with no sync pull for 365 days (or, if they never
pulled, created more than 365 days ago) and accounts whose key was regenerated
more than 30 days ago. At most 50 accounts are deleted per run. Deleted sync
data can persist in Cloudflare D1's point-in-time recovery (Time Travel) for up
to 30 days on the Workers Paid plan, after which it is gone. Sync state is stored in Cloudflare D1 and is never logged
or exposed to third parties. Synced lifetime reading statistics contain only
per-feed aggregate counters and compact per-item `everRead` markers; article
content and a detailed reading event history are not synchronized. Authorized
agent pulls can read the same aggregate statistics, while only the master sync
key can write statistics snapshots or historical markers. OAuth refresh tokens are stored as hashes. OAuth access tokens are signed JWTs and are not stored; provider signing keys are encrypted with `BETTER_AUTH_SECRET`. All agent access is revocable immediately from Settings → Agents.

## AI agents

Lidora runs a remote [MCP](https://modelcontextprotocol.io) server at `/mcp`, with
OAuth 2.1 authorisation on the same origin, implemented with Better Auth and its MCP and CIMD plugins on Workers, Node and Bun. Any MCP client that supports remote
servers and OAuth can connect by being given one URL. The agent's tool calls
come from its host, not from a code sandbox, so the agent needs no network
access to Lidora of its own. Sync must be turned on first, because the connector
works on the synced account.

Existing installations moving from Lidora’s custom OAuth implementation must configure `BETTER_AUTH_SECRET` before deployment. The migration requires agents to reconnect once; device sync and reading data are preserved. Agent connections must be approved again at the new origin.

### Connecting an agent

1. In Lidora, open Settings → Agents and choose **Connect an agent**. Lidora creates
   a single-use connection URL of the form `https://<your-origin>/mcp/c/<id>`,
   valid for ten minutes, and copies setup instructions that contain it.
2. Either paste the instructions into the agent's chat, or paste the URL into
   the agent's settings as a custom connector or remote MCP server. The
   instructions name no particular client: they describe the server (remote MCP,
   Streamable HTTP, OAuth) and ask the agent to add it user-wide and start the
   sign-in. Agents that can change their own configuration, such as coding
   agents with a shell, do this themselves; others say where to paste the URL.
   Nothing in the instructions asks the agent to fetch anything.
3. The agent opens a consent page in its own browser. Check the agent's name
   and press **Allow**. The page works in any browser, including one that has
   never run Lidora, because the connection URL identifies your account.

The connection URL stays valid as an address for `/mcp` after use, since clients
store it. Once spent, it no longer approves anything.

Two fallbacks apply when the URL has expired or been used, or when a client is
configured with the plain `https://<your-origin>/mcp`:

- If the consent page runs in a browser that holds your sync key, **Allow**
  works directly.
- Otherwise the consent page shows an 8-character approval code and a QR code.
  In Lidora, open Settings → Agents, tap **Have an approval code?**, enter or scan the
  code, check the agent's name and redirect host, and approve. The consent page
  then completes by itself. Approve only codes you generated by starting a
  connection yourself.

Behind a reverse proxy, set `PUBLIC_URL` (see Configuration) so that the OAuth
issuer and resource URLs use your public origin rather than the origin the proxy
forwards.

### What an agent can access

One **Allow** grants both scopes the client requests: `read` and `write`. A
client that asks only for `read` receives only `read`, and then sees only the
read tools. There are no per-scope or per-data-type choices.

| Tool | Scope | Purpose |
|---|---|---|
| `list_subscriptions` | read | Feeds with `feedId`, tags and reading statistics, sortable by engagement, title or backlog |
| `get_reading_stats` | read | Account and per-feed reading statistics |
| `list_items` | read | Recent articles, filtered by feed, tag, date, read state, starred state or text |
| `get_item` | read | One article converted to Markdown, truncated at a character limit |
| `discover_feeds` | read | Feed candidates for a site, page or feed URL, and whether you already subscribe |
| `subscribe` | write | Subscribe to a feed URL, or to the feed a page advertises |
| `update_subscription` | write | Set a subscription's title and tags |
| `unsubscribe` | write | Remove a subscription |
| `set_item_state` | write | Mark up to 100 items read, unread, starred or unstarred |

The server describes these workflows to the agent, so a prompt such as
"recommend feeds based on what I read" works without further instruction. The
agent must verify suggestions with `discover_feeds` before proposing them.
Write tools use the same merge as a device sync, so changes reach your browsers
on their next sync. `list_items` and `get_item` need server-side polling
(`FEED_POLLING`); without it they are not offered.

**Data exposure.** An agent can read everything Lidora synchronises: subscriptions,
tags, read and starred state and reading statistics. With polling enabled it
can also read the text of articles from the last seven days. That text is sent
to whichever model service the agent uses. Feed URLs in tool output have
embedded credentials removed: user information is dropped and the values of
query parameters whose names suggest a secret (token, key, auth, and similar)
are replaced with `REDACTED`. Item IDs are returned unchanged because the agent
must pass them back. Extracted full articles and detailed reading history stay
on your devices and are not available.

**Content limit.** Article content comes from the server's poll database, which
keeps items for seven days and covers at most 500 feeds per account. An agent
cannot read older articles through the connector.

**Rate limits.** Each connection has its own budget of 120 tool calls a minute,
separate from your devices' sync budget. `discover_feeds` is further limited to
20 a minute per account because it fetches from upstream sites.

### Managing connections

Settings → Agents lists every connected agent with its name, access, creation
date and last use.

- **Identify and rename.** Agents appear under the name they registered with.
  Rename gives one a label you will recognise, such as "Work laptop".
- **Lifetime.** Access tokens last one hour and the agent renews them silently
  with a refresh token. Lidora grants `offline_access` to every connection, so
  agents that request only `read write` stay connected too. Each renewal extends
  the connection, which ends after a year without use. An agent whose grant has
  expired or been revoked must be connected again.
- **Revoke.** Revoke invalidates the grant's access and refresh tokens at once. It
  does not affect your devices.
- **Kill switch.** Regenerating the sync key (Settings → Server data → Sign out other devices and agents)
  stops every agent connection immediately. Deleting sync
  data does the same and removes the account.

A grant gives the agent read and write access to your subscriptions. Treat the
connection URL and approval codes like passwords for the ten minutes they live,
and revoke agents you no longer use.

### HTTP API

Tools that do not speak MCP can call the sync API directly. It is described at
`https://lidora.app/openapi.json`, which documents the HTTP
bearer scheme for agents, the `X-Sync-Key` header for devices, and the scope
each operation needs. Obtain an OAuth access token through the metadata at
`/.well-known/oauth-authorization-server/oauth` and send it as
`Authorization: Bearer <token>`. `read` allows `/sync/pull`,
`/sync/stats/pull` and `/sync/items`; `write` additionally allows `/sync/push`
(403 without it). Statistics writes, device pairing, registration and agent
management remain master-key-only. Writes carry no timestamps; the server stamps
everything. `/llms.txt` gives agents a short description of the connector.

## Known v0 limitations

- **Self-hosted sync is single-process.** Node, Bun and Docker can use local SQLite, but multiple Lidora processes cannot share the same data directory.
- **No push notifications.** Browser refresh runs only while the app is open; on Workers with polling enabled, synced devices receive items polled in the meantime on their next sync.
- **No bulk "mark all read" or multi-select.** Reading is the marking mechanism.
- **No per-feed customization** (colors, sort overrides, custom refresh intervals).
- **Service Worker background sync is not used** — without server-side polling, feeds don't refresh when the tab is closed.
- **Search** matches article titles and summaries, not article text, and covers
  only the articles stored on the device.
- **Local article retention.** Unstarred article bodies are removed after 90 days
  without appearing in a feed refresh or sync pull. Unstarred unread records are
  removed after 365 days; read and starred records remain. Settings shows local
  storage usage and lets you request persistent browser storage.
- **No Content-Security-Policy on the app shell.** Article HTML is sanitised, but
  the app pages do not yet send a policy that would block inline script as a
  second barrier.
- **OPML import/export covers only the subscription list.** Read/starred state is
  intentionally not exported in v0 (no standard format).

## License

MIT. The MCP endpoint depends on the Apache-2.0 licensed
`@modelcontextprotocol/server`, which is compatible with the MIT licence.
