# Preserve permanent feed URL changes and stop polling removed feeds

Feed publishers can move a feed permanently or retire it. Sift currently follows redirects without updating subscriptions and retries HTTP 410 responses indefinitely. The fetcher also identifies itself with an outdated version and repository link. This change makes the fetcher identity accurate, adopts repeatedly observed permanent feed destinations across local and synced subscriptions, and treats 410 as a permanent removal that users can act on.

The fetcher User-Agent will not disclose subscriber counts. Sift deliberately omits audience counts to protect reader privacy, and will not offer a setting to enable them.

## Scope

- Derive the upstream fetcher User-Agent version from `package.json` and link to the public About page.
- Carry a validated final feed URL through the feed proxy and shared cache. Change a subscription only after two independent upstream fetches report the same 301/308 destination; keep temporary redirects unchanged.
- Preserve the stable feed ID and sync the updated URL with the normal per-field timestamp rules. The poller will apply the same repeated-observation rule and update all live synced rows for that URL.
- Treat HTTP 410 as permanent: stop server polling, prevent automatic browser retries, identify the removed feed in the reader, and provide the existing unsubscribe action in its editor.
- Specify the privacy rule against subscriber counts in fetcher User-Agents. No count, setting, UI, or public copy will be added.

## Out of scope

- Rewriting a subscription after a temporary redirect.
- Automatically unsubscribing a user after HTTP 410.
- Changing article or image redirect behavior.

## Impact

- `upstream-request-governance`: describe the Sift fetcher identity, redirect confirmation, and subscriber-count privacy rule.
- `server-feed-polling`: describe permanent redirect migration and permanent 410 suppression.
- `reader-ui`: describe removed-feed state and the unsubscribe path.
- README: describe polling behavior for permanent redirects and 410 responses.
