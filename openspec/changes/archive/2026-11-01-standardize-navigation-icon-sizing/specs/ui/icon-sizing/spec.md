## ADDED Requirements

### Requirement: Consistent navigation and toolbar icon sizing

Navigation and toolbar call-to-action icons SHALL use 16 px Lucide icons on desktop. Secondary article-row actions SHALL use 14 px icons, and compact inline actions such as tag removal SHALL use 12 px icons. Mobile reader action-bar icons MAY use 16–18 px icons to suit their larger touch targets. These icon sizes SHALL NOT determine or reduce interactive hit-area sizes.

#### Scenario: Desktop navigation and toolbar actions
- **WHEN** a desktop navigation or toolbar call-to-action is shown
- **THEN** its Lucide icon SHALL use 16 px

#### Scenario: Secondary and compact actions
- **WHEN** a secondary article-row or compact inline action is shown
- **THEN** its icon SHALL use the size specified for that action class

#### Scenario: Mobile reader actions
- **WHEN** the reader action bar is shown on mobile
- **THEN** its icons MAY use 16–18 px while retaining touch targets appropriate for touch input
