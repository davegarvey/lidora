# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Sidebar filter control`
- TO: `### Requirement: List header filter control`

## MODIFIED Requirements

### Requirement: List header filter control
The control SHALL be a single icon toggle (Lucide `CircleDot`) in the article list header beside Starred, on desktop and mobile. Pressed SHALL mean Unread; unpressed SHALL mean All. It SHALL NOT appear in the sidebar chips, the mobile sidebar drawer, the collapsed desktop rail or the mobile top bar. While Starred is active the toggle SHALL be disabled and not highlighted. The toggle SHALL have an accessible name, expose its pressed state and support keyboard and touch activation.

#### Scenario: Browse the article list
- **WHEN** the article list is visible on desktop or mobile
- **THEN** the Unread toggle SHALL appear in the article list header
- **AND** it SHALL NOT appear among the sidebar tag chips

#### Scenario: Starred active
- **WHEN** Starred is active
- **THEN** the Unread toggle SHALL be disabled and SHALL retain the remembered mode for when Starred is disabled
