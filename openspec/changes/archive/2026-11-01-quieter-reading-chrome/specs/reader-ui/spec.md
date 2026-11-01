## ADDED Requirements

### Requirement: Reading star is neutral until starred
The star button in the reading chrome and the mobile bottom action bar SHALL use the neutral icon colour when the article is not starred and the Mauve accent when it is starred. Its Mauve hover wash SHALL apply only when the article is starred.

#### Scenario: Unstarred article
- **WHEN** the open article is not starred
- **THEN** the star button SHALL use the same neutral colour as the neighbouring action buttons

#### Scenario: Starred article
- **WHEN** the open article is starred
- **THEN** the star button SHALL use the Mauve accent and a filled star icon

## REMOVED Requirements

### Requirement: Help CTA is desktop-only
**Reason**: The reading chrome no longer shows a keyboard-shortcuts button. Help is rarely needed, is unrelated to the open article, and remains available from the sidebar, Settings and the `?` key.
**Migration**: None.
