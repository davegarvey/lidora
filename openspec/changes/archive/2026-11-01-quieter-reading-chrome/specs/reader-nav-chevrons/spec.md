## MODIFIED Requirements

### Requirement: Chrome simplification
The sticky reading chrome SHALL display only a back arrow (no text) where applicable, the chrome title within a flex spacer, and action buttons that act on the open article or reading layout (focus mode, ranking feedback, star, open original). It SHALL NOT display a keyboard-shortcuts button, library activity or pending list actions. Feed name and relative time SHALL NOT appear in the chrome.

#### Scenario: Chrome shows back arrow only (no "All" text)
- **WHEN** user is in reading view
- **THEN** the leftmost chrome element SHALL be a back arrow icon with no accompanying text label

#### Scenario: No feed name or relative time in chrome
- **WHEN** user is in reading view
- **THEN** the chrome SHALL NOT display the feed name or relative time

#### Scenario: No transient or unrelated controls in chrome
- **WHEN** user is in reading view while library updates run or arrivals are pending
- **THEN** the chrome SHALL NOT display an activity icon, a Show action or a keyboard-shortcuts button
