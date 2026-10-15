## MODIFIED Requirements

### Requirement: Settings UI reflects orthogonal model

The Appearance section of Settings SHALL present theme selection (system/light/dark) and the high contrast toggle as separate controls. Theme selection SHALL be a segmented control and high contrast SHALL be a switch.

#### Scenario: Theme selector excludes accessible
- **WHEN** user opens the Appearance section
- **THEN** the theme control SHALL show three options: "System", "Light", "Dark"

#### Scenario: High contrast toggle present
- **WHEN** user opens the Appearance section
- **THEN** the high contrast switch SHALL be visible and independent of the theme control
