## MODIFIED Requirements

### Requirement: Focus mode is an optional persistent desktop layout

The desktop reader toolbar SHALL provide an icon-only focus-mode toggle. When focus mode is disabled, its tooltip SHALL read “Enable focus mode”; when enabled, its tooltip SHALL read “Disable focus mode”. Enabling focus mode SHALL hide the feed navigation and article list while keeping the current article open. In focus mode, a back button SHALL close the article and return to the river without changing the saved focus-mode preference. Disabling focus mode SHALL restore the desktop panes without changing their saved widths. The focus-mode preference SHALL be saved locally until the user toggles it off. The focus-mode toggle SHALL NOT be shown in the mobile single-column flow, where article-only reading is already the default.

#### Scenario: First desktop use defaults to panes visible
- **WHEN** the user has no saved focus-mode preference
- **THEN** the desktop workspace shows the feed navigation, article list, and reader
- **AND** the focus-mode toggle tooltip reads “Enable focus mode”

#### Scenario: Enable focus mode
- **WHEN** the user activates the focus-mode toggle while desktop panes are visible
- **THEN** the feed navigation and article list are hidden
- **AND** the current article remains open in the expanded reader
- **AND** the toggle tooltip reads “Disable focus mode”

#### Scenario: Disable focus mode
- **WHEN** the user activates the focus-mode toggle while focus mode is enabled
- **THEN** the feed navigation and article list are restored
- **AND** the current article remains open
- **AND** the toggle tooltip reads “Enable focus mode”

#### Scenario: Return to the river from focus mode
- **WHEN** the user activates the back button while reading in focus mode
- **THEN** the article closes and the river view appears
- **AND** the saved focus-mode preference remains enabled

#### Scenario: Restore focus preference on a later visit
- **WHEN** the user previously enabled focus mode and returns to Lidora on the same device
- **THEN** the desktop reader opens with focus mode enabled until the user disables it

#### Scenario: Focus preference does not alter mobile navigation
- **WHEN** the viewport is 768 CSS pixels wide or narrower
- **THEN** the existing mobile single-column reading flow is used regardless of the saved desktop focus preference
- **AND** no focus-mode toggle is shown

