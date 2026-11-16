## 1. OpenSpec

- [x] 1.1 Validate the change and resolve any spec or design issues.

## 2. Fetcher identity and redirect metadata

- [x] 2.1 Build the User-Agent from package metadata and the public About URL.
- [x] 2.2 Preserve validated permanent redirect metadata through feed caching and the `/feed` response only.
- [x] 2.3 Add fetcher identity and redirect behavior tests, including cache-hit and unsafe-target cases.

## 3. Browser subscription behavior

- [x] 3.1 Persist consecutive redirect evidence and permanent removal state in local feed records.
- [x] 3.2 Adopt a confirmed destination through the existing URL-change and sync queue path.
- [x] 3.3 Show removed-feed state and the unsubscribe action; clear local state on URL change.
- [x] 3.4 Cover redirect confirmation, temporary redirects, 410 retry suppression, and URL recovery.

## 4. Server polling behavior

- [x] 4.1 Persist redirect candidates and migrate confirmed URLs and retained items safely.
- [x] 4.2 Stop URLs after 410 and keep maintenance from reactivating them.
- [x] 4.3 Cover migration across subscribers, concurrent URL edits, duplicate items, and permanent 410 suppression.

## 5. Documentation and verification

- [x] 5.1 Update the README polling description and upstream fetcher identity.
- [x] 5.2 Run strict OpenSpec validation, typecheck, lint, targeted tests, and build.

The change validates with `openspec validate permanent-feed-redirects-and-gone-status --strict`. Repository-wide strict spec validation still reports pre-existing long-requirement failures in other main specs. The full Vitest run under Node 26 has one unrelated environment failure in `connect-no-state.test.tsx` because `localStorage` is undefined; the remaining tests pass.
