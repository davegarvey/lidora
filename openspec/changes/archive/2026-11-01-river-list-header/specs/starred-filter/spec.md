# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Sidebar star toggle`
- TO: `### Requirement: List header star toggle`

## MODIFIED Requirements

### Requirement: List header star toggle
The article list header SHALL display a ★ button that toggles the starred-only filter on and off. The button SHALL use the Mauve accent color when active and SHALL have a filled star icon when active. Its accessible name and tooltip SHALL describe filtering to starred articles, distinct from starring the open article. The button SHALL NOT clear `riverScope` or `activeTags` when toggled.

#### Scenario: Toggle star filter on
- **WHEN** the user clicks the ★ button in the article list header
- **THEN** the star filter becomes active
- **AND** the ★ button displays with filled icon and active accent color
- **AND** the current item list narrows to show only starred items
- **AND** `riverScope` and `activeTags` are unchanged

#### Scenario: Toggle star filter off
- **WHEN** the user clicks the ★ button while the star filter is active
- **THEN** the star filter becomes inactive
- **AND** the ★ button displays with outline/unfilled icon
- **AND** the item list returns to showing all items for the current scope
- **AND** `riverScope` and `activeTags` are unchanged

#### Scenario: Star filter persists across view switches
- **WHEN** the user has the star filter active while viewing "all"
- **AND** the user clicks a tag or feed
- **THEN** the star filter SHALL remain active
- **AND** the items displayed SHALL be starred items within the new view

## REMOVED Requirements

### Requirement: Collapsed sidebar rail
**Reason**: The article list header is visible whether or not the desktop sidebar is collapsed, so the rail copy is redundant.
**Migration**: Use the ★ button in the article list header.
