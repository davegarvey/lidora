## MODIFIED Requirements

### Requirement: Consistent navigation and toolbar icon sizing

Clickable navigation, toolbar and row-action controls SHALL use 16 px Lucide icons on desktop. Noninteractive status and drag indicators SHALL use 14 px icons; compact inline affordances or tiny status markers, such as tag removal or a feed error mark, SHALL use 12 px icons. Mobile reader action-bar icons MAY use 16–18 px icons to suit their larger touch targets. Icon size SHALL NOT determine or reduce interactive hit-area sizes.

#### Scenario: Desktop navigation and toolbar actions
- **WHEN** a desktop navigation, toolbar or row-action control is shown
- **THEN** its Lucide icon SHALL use 16 px

#### Scenario: Secondary and compact actions
- **WHEN** a noninteractive status or drag indicator is shown
- **THEN** its icon SHALL use 14 px
- **AND** a compact inline affordance or tiny status marker SHALL use 12 px

#### Scenario: Mobile reader actions
- **WHEN** the reader action bar is shown on mobile
- **THEN** its icons MAY use 16–18 px while retaining touch targets appropriate for touch input
