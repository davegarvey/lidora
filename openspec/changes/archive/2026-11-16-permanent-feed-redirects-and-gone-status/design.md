# Design: permanent feed redirects and gone responses

## Fetcher identity

Import the package metadata in the shared server fetch module and form one descriptive User-Agent from its version and the public About URL. All upstream paths keep the same truthful identity. Subscriber counts remain absent by policy because they disclose audience size to publishers.

## Permanent redirect evidence

The shared upstream fetch loop already validates every redirect destination and bounds chains to five hops. Extend its feed result metadata to retain the final URL and whether the chain included a 301 or 308. Carry that metadata in the successful cache entry and `/feed` response, without changing article or image responses.

The browser stores the last candidate destination and its observation count on the local feed record. Only a network response (`miss` or `revalidated`) counts as an observation; a cache hit does not. Two consecutive independent observations of the same final URL allow the client to call the existing URL-change service. A changed or absent candidate clears the observation. URL change keeps the feed ID, clears validators and refresh errors, and flows through the existing sync queue and timestamp conflict rules.

The poll database stores the candidate URL and observation count with its existing per-URL polling row. On the second independent observation, the poller updates every live synced subscription still pointing to the old URL, with a server timestamp, and migrates the poll registry and retained items to the destination. The destination has passed the existing URL validation on every redirect hop. Temporary redirects do not contribute evidence.

## HTTP 410

The browser persists a removed marker on the local feed, clears refresh error state, and excludes that feed from automatic scheduling until its URL is changed. The sidebar indicates removal; the feed editor explains HTTP 410 and exposes its existing unsubscribe action. Changing the URL clears the marker.

The poller records `last_status = 410` and makes the row ineligible for future due batches. Registry maintenance inserts missing rows only and does not reactivate an existing removed row. A deliberate subscription to a different URL creates its own polling row.

## Data and privacy

Local redirect evidence and removed state are local-only feed metadata. Poll redirect evidence is stored beside the already retained feed URL in the poll database; it is not keyed by account. The sync database update touches only live rows whose URL still matches the confirmed old URL. No subscriber count is calculated or sent upstream.

## Risks

- Repeated publisher misconfiguration can still move a subscription after two independent permanent responses. Requiring the same validated destination twice limits one-off mistakes while allowing recovery without user intervention.
- A concurrent user URL edit must win over background canonicalization. Update only rows that still contain the old URL, and use the server's normal feed URL timestamp.
- Poll item migration can encounter duplicate GUIDs at the destination. Insert-or-ignore preserves one copy, then remove the old URL's rows.
