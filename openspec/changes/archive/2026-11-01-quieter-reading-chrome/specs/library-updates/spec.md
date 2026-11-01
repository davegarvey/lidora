## MODIFIED Requirements

### Requirement: Quiet feedback occupies existing chrome
The client SHALL present neutral Header whisper feedback within existing mobile top-bar or desktop navigation chrome, without adding vertical layout, overlaying articles or moving existing header controls. The reading chrome SHALL NOT show library activity or pending list actions. Passive activity SHALL appear after 300 ms and, once visible, remain at least 300 ms. Completion SHALL clear quietly. The cue SHALL use no Mauve activity accent or percentage progress.

#### Scenario: Fast background operation
- **WHEN** background processing and reconciliation finish within 300 ms
- **THEN** no passive activity cue SHALL flash

#### Scenario: Long background operation
- **WHEN** processing remains active beyond 300 ms
- **THEN** the relevant existing chrome SHALL show one neutral rotating Lucide activity icon, without visible Updating text
- **AND** a collapsed list navigation rail SHALL reuse its existing brand slot for the icon, without adding an action row

#### Scenario: Phone reader hides the list header
- **WHEN** the user reads on a phone or in desktop focus mode while library updates run
- **THEN** no activity cue SHALL be shown
- **AND** pending list actions SHALL be offered upon return to the list

#### Scenario: Compact desktop navigation
- **WHEN** the desktop navigation is collapsed
- **THEN** activity SHALL remain discoverable in the rail's brand slot, including while an article is open
- **AND** a pending text action SHALL NOT overflow the rail

#### Scenario: Desktop reader and navigation are both visible
- **WHEN** the reader is open while a desktop sidebar or navigation drawer is also visible
- **THEN** the sidebar header SHALL expose activity and any pending Show action
- **AND** the reading chrome and per-feed activity indicators SHALL NOT duplicate it

#### Scenario: Reduced motion
- **WHEN** reduced motion is requested and activity is shown
- **THEN** the icon SHALL remain still and retain its accessible Updating articles label

#### Scenario: Activity and pending arrivals coexist
- **WHEN** arrivals are waiting and another operation is active
- **THEN** the Show action SHALL remain still and actionable beside the single activity icon
- **AND** no visible Updating text SHALL be added
