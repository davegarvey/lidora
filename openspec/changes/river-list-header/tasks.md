# Tasks

## 1. List header

- [x] 1.1 Add the article list header to the river view with the scope title and the Starred, Unread and For you icon buttons wired to the existing actions; verify titles for all, feed and multi-tag scopes, truncation, pressed states, the disabled Unread state while Starred is active, and absence in stats, settings and the zero-feed state.
- [x] 1.2 Style the header to match the reading chrome: 40px, list background, border only once scrolled, sticky on desktop; verify alignment with the reading chrome in the three-pane layout and in light, dark and high-contrast themes.
- [x] 1.3 Place the header as the first element inside the mobile list below the fixed top bar so it scrolls away; verify 44px touch targets, the unchanged top bar and that the first article sits directly below the header.

## 2. Sidebar clean-up

- [x] 2.1 Remove Starred, Unread and For you from the sidebar chip row, the mobile drawer and the collapsed desktop rail, and drop the unused Sparkles import; verify the chip row holds only `all` and tags and the rail keeps its other actions.
- [x] 2.2 Update affected component tests and add header coverage for accessible names, pressed state and toggle composition.

## 3. Documentation and verification

- [x] 3.1 Update the README wherever it describes the location of the Starred, Unread or For you controls.
- [ ] 3.2 Run typecheck, lint, tests and build, check desktop, three-pane and mobile layouts in the browser, and run `openspec validate river-list-header --strict`.

## Workflow follow-up

- After implementation is complete, archive this change and include the archived change plus synchronised main specs in the implementation PR.
- Run `npm run spec:validate` after archival and verify the change is no longer active.
