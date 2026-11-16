## MODIFIED Requirements

### Requirement: Document title sync

The browser tab/window title SHALL reflect the article being read and reset when leaving reading view.

#### Scenario: Title set on open

- **WHEN** the reading view opens with an article
- **THEN** `document.title` SHALL be set to `"<article title> — Lidora"`

#### Scenario: Title updated on navigation

- **WHEN** the user navigates to a different article (prev/next) within the reading view
- **THEN** `document.title` SHALL update to `"<new article title> — Lidora"`

#### Scenario: Title reset on close

- **WHEN** the user returns to the river view
- **THEN** `document.title` SHALL be set to `"Lidora"`
