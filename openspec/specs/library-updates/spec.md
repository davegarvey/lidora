# library-updates Specification

## Purpose
Define how Lidora reports ongoing library work and presents background article changes without disrupting the reader's place.

## Requirements

### Requirement: Activity covers the complete library update
The client SHALL track work that may affect the selected list from fetch/sync or local reload through parsing, sanitisation, storage, relevant cleanup, querying, and visible publication or pending-result preparation. Overlapping operations SHALL remain active until all relevant work and reconciliation settle. For a visible publication, activity SHALL remain through a browser rendering opportunity; hidden tabs SHALL NOT wait indefinitely for animation frames.

#### Scenario: Unrelated background work
- **WHEN** only upload queue flushing, unrelated statistics or retry backoff remains
- **THEN** library activity SHALL NOT remain active for that work

#### Scenario: Download completes before processing
- **WHEN** feed download completes but parsing, sanitising, saving or querying is still in progress
- **THEN** the operation SHALL remain active
- **AND** activity SHALL NOT finish merely because network requests have finished

#### Scenario: Multiple sources overlap
- **WHEN** an automatic refresh and sync ingestion overlap and both invalidate the selected list
- **THEN** activity SHALL continue until both and their resulting reconciliation settle

#### Scenario: Processing fails
- **WHEN** any update stage fails or is cancelled
- **THEN** its activity token SHALL be released after necessary reconciliation attempts
- **AND** existing actionable error feedback SHALL remain available
- **AND** failure SHALL NOT produce a successful-update message

#### Scenario: Pending results finish processing
- **WHEN** a background candidate is ready but deliberately held from the visible list
- **THEN** processing activity SHALL be allowed to end
- **AND** the pending Show action SHALL remain available

### Requirement: Quiet feedback occupies existing chrome
The client SHALL present neutral Header whisper feedback within existing mobile top-bar, desktop navigation or reader chrome, without adding vertical layout, overlaying articles or moving existing header controls. Passive activity SHALL appear after 300 ms and, once visible, remain at least 300 ms. Completion SHALL clear quietly. The cue SHALL use no Mauve activity accent or percentage progress.

#### Scenario: Fast background operation
- **WHEN** background processing and reconciliation finish within 300 ms
- **THEN** no passive activity cue SHALL flash

#### Scenario: Long background operation
- **WHEN** processing remains active beyond 300 ms
- **THEN** the relevant existing chrome SHALL show one neutral rotating Lucide activity icon, without visible Updating text
- **AND** a collapsed list navigation rail SHALL reuse its existing brand slot for the icon, without adding an action row

#### Scenario: Phone reader hides the list header
- **WHEN** the user reads on a phone while library updates run
- **THEN** activity SHALL use the existing reading chrome
- **AND** it SHALL NOT add another header
- **AND** pending list actions SHALL be offered upon return to the list

#### Scenario: Compact desktop navigation
- **WHEN** the desktop navigation is collapsed
- **THEN** activity SHALL remain discoverable in existing chrome
- **AND** a pending text action SHALL use available reader chrome instead of overflowing the rail

#### Scenario: Desktop reader and navigation are both visible
- **WHEN** the reader is open while a desktop sidebar or navigation drawer is also visible
- **THEN** only the reader header SHALL expose activity
- **AND** sidebar and per-feed activity indicators SHALL NOT duplicate it

#### Scenario: Reduced motion
- **WHEN** reduced motion is requested and activity is shown
- **THEN** the icon SHALL remain still and retain its accessible Updating articles label

#### Scenario: Activity and pending arrivals coexist
- **WHEN** arrivals are waiting and another operation is active
- **THEN** the Show action SHALL remain still and actionable beside the single activity icon
- **AND** no visible Updating text SHALL be added

### Requirement: Background list changes wait for reader intent by default
After a non-empty list has been presented, the client SHALL persist background data immediately but defer changes to list membership and ordering while automatic arrivals are off. Resume and idle catch-up SHALL follow this policy. Own read/star actions SHALL apply immediately without admitting unrelated held arrivals. Feed removal, identity changes and missing records SHALL be reconciled safely without leaving stale actionable entries.

#### Scenario: Background articles arrive during browsing
- **WHEN** background refresh or sync introduces eligible articles while a non-empty list is displayed and automatic arrivals are off
- **THEN** the current article order, scroll anchor and focused article SHALL remain stable
- **AND** the client SHALL offer an explicit Show action

#### Scenario: Changes synced from another device
- **WHEN** remote changes would remove or reorder displayed rows
- **THEN** those presentation changes SHALL be deferred
- **AND** the action SHALL read `Show updates` if an additions-only label would be incomplete

#### Scenario: Local action while arrivals wait
- **WHEN** the user marks an article read or changes its star state while background arrivals are pending
- **THEN** the user's action and filter consequences SHALL apply immediately
- **AND** unrelated held arrivals SHALL remain held unless the resulting list is empty

#### Scenario: Return after suspension
- **WHEN** an existing session resumes and a permitted local reload or sync finds new articles
- **THEN** the existing non-empty presentation SHALL remain stable with a Show action
- **AND** existing absence/idle/network gates SHALL remain in force

### Requirement: Pending actions describe the active result
For additions alone, the action SHALL read `Show N new` and count distinct eligible IDs in the latest candidate result absent from the presented list, respecting feed/tag/read/star predicates and the existing result limit. Mixed or other deferred changes SHALL use `Show updates`. Pending state SHALL be recomputed rather than accumulated blindly and SHALL clear when no difference remains. Pending presentation state SHALL be ephemeral across full app loads.

#### Scenario: Duplicate and out-of-scope arrivals
- **WHEN** another batch contains duplicate IDs or articles excluded from the current result
- **THEN** those articles SHALL NOT increase the displayed count

#### Scenario: Result limit
- **WHEN** arrivals include eligible articles outside the current result limit
- **THEN** the action SHALL count only additions to the candidate result that Show would publish

#### Scenario: Further arrivals while Show is available
- **WHEN** additional matching results finish processing
- **THEN** the pending candidate and count SHALL update without moving displayed rows
- **AND** any continuing activity SHALL be conveyed without hiding or stealing focus from the Show action

### Requirement: Explicit actions publish current results
Explicit refresh, a new feed/filter selection, initial hydration and an empty list SHALL publish current results regardless of the automatic-arrival preference. Show SHALL publish the newest complete candidate, reveal the list from the top without smooth scrolling, and preserve later in-flight invalidations. Explicit refresh SHALL preserve the visible article anchor and keyboard focus by ID where eligible, falling back to the nearest surviving neighbour.

#### Scenario: User selects Show
- **WHEN** the user activates `Show N new` or `Show updates`
- **THEN** the latest complete candidate SHALL become visible from the top
- **AND** disappearing-button keyboard focus SHALL move to the first available article control or the empty-state control
- **AND** the action SHALL NOT initiate an upstream refresh

#### Scenario: New work arrives during Show
- **WHEN** an update completes while Show is committing an earlier candidate
- **THEN** the later revision SHALL NOT be lost or falsely treated as already shown
- **AND** activity or a pending action SHALL reflect the outstanding work

#### Scenario: User explicitly refreshes
- **WHEN** an explicit refresh completes
- **THEN** its final result SHALL be published without a second Show action
- **AND** the visible anchor and keyboard-focused article SHALL be preserved where eligible

#### Scenario: Empty list or new selection
- **WHEN** an empty list receives eligible data or the user changes feed or filters
- **THEN** the latest matching result SHALL be shown automatically
- **AND** pending state from the previous presentation SHALL NOT leak into the new selection

#### Scenario: Open article during arrivals
- **WHEN** library changes arrive while an article is open
- **THEN** the open article SHALL NOT be replaced, navigated or scrolled by those changes
- **AND** returning to the list in manual-arrival mode SHALL preserve its snapshot subject to local actions and existing return-to-item/neighbour rules

### Requirement: Automatic arrivals preserve reading position
When automatic arrivals are enabled, background results SHALL publish automatically, preserving the first visible article's ID and pixel offset and the keyboard-focused article's identity where they remain eligible. If removed, the nearest surviving neighbour SHALL be used. This mode SHALL NOT interrupt the open article.

#### Scenario: Automatic insertion above the viewport
- **WHEN** new articles are inserted above the visible anchor with automatic arrivals enabled
- **THEN** the same article SHALL remain at the same viewport offset where possible
- **AND** keyboard focus SHALL remain on the same article by ID

### Requirement: Update controls remain accessible and quiet
The activity icon SHALL be noninteractive with an accessible Updating articles label. Show actions SHALL be visibly underlined native buttons with descriptive accessible names, keyboard focus styles and at least 44px effective touch targets. Controls SHALL fit a 320px viewport and enlarged text without overlap or added rows. An unusually large count MAY use visible `Show new` with an exact-count accessible name.

#### Scenario: Mobile user recognises the action
- **WHEN** matching articles are waiting on a narrow viewport
- **THEN** a visible verb and underline SHALL distinguish the Show action from the activity icon without requiring hover

### Requirement: Status announcements avoid interruption
The client SHALL use one polite live-announcement source and announce availability once per pending episode rather than every count increment. Reduced motion SHALL remain understandable.

#### Scenario: Several mounted chrome surfaces
- **WHEN** responsive layout mounts multiple possible status locations
- **THEN** only the relevant operative action SHALL be exposed for the visible list
- **AND** assistive technology SHALL NOT receive duplicate status announcements

### Requirement: Large-library updates remain responsive
The implementation SHALL measure parsing, sanitisation, writes, queries, publication and browser rendering with 1,000- and 5,000-article fixtures, reduce identified long synchronous processing, and allow input/rendering opportunities during bulk work. It SHALL preserve sanitisation, identity, read/star merge and database transaction guarantees. Validation SHALL include CPU-throttled browser checks and a real mobile-device check; emulation alone SHALL NOT be reported as real-device validation.

#### Scenario: Large ingestion during interaction
- **WHEN** a large feed or sync batch is processed while the user scrolls or activates a control
- **THEN** processing SHALL yield or run off the UI thread so input and rendering can progress
- **AND** the activity lifecycle SHALL remain accurate through final presentation

#### Scenario: Batched HTML processing
- **WHEN** sanitisation is broken into batches
- **THEN** all stored HTML SHALL still pass the existing sanitiser
- **AND** scheduling SHALL NOT accidentally close live IndexedDB write transactions
