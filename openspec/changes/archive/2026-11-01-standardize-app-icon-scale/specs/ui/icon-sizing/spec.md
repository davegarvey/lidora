## MODIFIED Requirements

### Requirement: Consistent navigation and toolbar icon sizing

The icon that serves as an action control's visual cue SHALL use 16 px across navigation, toolbars, rows, settings, forms, dialogs and mobile controls, whether alone or alongside a short label. Inline adornments, input hints, drag handles, sort-direction hints and status spinners SHALL use 14 px. Compact inline affordances and tiny status markers SHALL use 12 px. Noninteractive swipe cues MAY use 22 px. Icon size SHALL NOT determine or reduce interactive hit-area sizes; coarse-pointer controls SHALL provide at least 44 × 44 CSS px hit areas.

#### Scenario: Desktop navigation and toolbar actions
- **WHEN** an action control appears in navigation, a toolbar, a row, settings, a form or a dialog
- **THEN** its action icon SHALL use 16 px

#### Scenario: Secondary and compact actions
- **WHEN** an inline adornment, input hint, drag handle, sort-direction hint or status spinner is shown
- **THEN** its icon SHALL use 14 px
- **AND** a compact inline affordance or tiny status marker SHALL use 12 px

#### Scenario: Mobile reader actions
- **WHEN** the reader action bar is shown on mobile
- **THEN** its action icons SHALL use 16 px
- **AND** its hit areas SHALL be sized independently from the icons

#### Scenario: Swipe feedback
- **WHEN** a noninteractive visual cue is shown during an article swipe
- **THEN** its icon MAY use 22 px
