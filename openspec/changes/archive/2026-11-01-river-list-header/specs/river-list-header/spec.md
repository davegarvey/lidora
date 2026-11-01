# Spec Delta

## ADDED Requirements

### Requirement: Article list header

The river view SHALL show a header at the top of the article list containing a scope title and the Starred, Unread and For you toggles. The header SHALL be 40px high on desktop, matching the reading pane chrome, and SHALL use the article list background with no bottom border until the list has scrolled. It SHALL NOT appear in the stats or settings views or in the zero-feed welcome state, and SHALL NOT hold controls other than these three toggles.

#### Scenario: Desktop three-pane layout
- **WHEN** an article is open in the desktop three-pane layout
- **THEN** the list header and the reading pane chrome SHALL share the same height and top edge

#### Scenario: Header scrolls into a bordered state
- **WHEN** the reader scrolls the article list on desktop
- **THEN** the header SHALL remain at the top of the list pane
- **AND** it SHALL show a bottom border while the list is scrolled

#### Scenario: Header is not shown outside the river
- **WHEN** the stats view, settings view or zero-feed welcome state is shown
- **THEN** no list header SHALL be displayed

### Requirement: Scope title

The header title SHALL name the current scope: `All` when no feed or tag is selected, the feed title when a feed is selected, and the selected tag names joined with commas when tags are active. A long title SHALL truncate with an ellipsis and SHALL NOT push the toggles out of view.

#### Scenario: Feed selected
- **WHEN** the reader selects a feed in the sidebar
- **THEN** the header title SHALL show that feed's title

#### Scenario: Several tags selected
- **WHEN** the reader selects more than one tag
- **THEN** the header title SHALL list the selected tags
- **AND** the toggles SHALL remain fully visible

### Requirement: Independent list toggles

The header SHALL present Starred, Unread and For you as separate square icon buttons, each with an accessible name, a tooltip and an exposed pressed state, operable by pointer, keyboard and touch. They SHALL NOT be presented as a joined single-choice control. They SHALL call the existing starred, read-mode and article-order actions and SHALL NOT change their behaviour.

#### Scenario: Toggles compose
- **WHEN** Unread and For you are both pressed
- **THEN** both buttons SHALL show their pressed state
- **AND** the list SHALL show unread articles in For you order

#### Scenario: Touch targets on mobile
- **WHEN** the header is shown on a touch device
- **THEN** each toggle SHALL have a hit area of at least 44 by 44 CSS pixels

### Requirement: Mobile list header placement

On mobile viewports the header SHALL be the first element inside the scrolling article list, directly below the fixed top bar, and SHALL scroll away with the list. The fixed top bar SHALL NOT change.

#### Scenario: Scroll the mobile list
- **WHEN** the reader scrolls down the article list on mobile
- **THEN** the header SHALL scroll out of view with the list
- **AND** only the existing top bar SHALL remain fixed

#### Scenario: Toggle without opening the drawer
- **WHEN** the reader is at the top of the article list on mobile
- **THEN** the Starred, Unread and For you toggles SHALL be operable without opening the sidebar drawer
