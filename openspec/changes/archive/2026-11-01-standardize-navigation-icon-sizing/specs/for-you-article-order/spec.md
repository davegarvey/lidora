## MODIFIED Requirements

### Requirement: Quiet ordering control

The Latest and For you control SHALL be a single icon toggle in the article list header. It SHALL show the Lucide `Lightbulb` icon when For you is selected and `ArrowDownWideNarrow` when Latest is selected. Both icons SHALL be 16 px. Pressed SHALL mean For you; unpressed SHALL mean Latest. Its accessible name and tooltip SHALL state the current order. It SHALL NOT appear in the sidebar chips, the mobile sidebar drawer or the collapsed desktop rail. It SHALL be accessible by pointer, keyboard and touch and expose its pressed state to assistive technology.

#### Scenario: Choose an order without obscuring articles
- **WHEN** the article list is shown on desktop or mobile
- **THEN** the reader SHALL be able to switch between Latest and For you from the list header
- **AND** the control SHALL NOT appear among the sidebar tag chips

#### Scenario: Selected order is announced
- **WHEN** a screen reader focuses the ordering control
- **THEN** it SHALL announce that the control sets the article order and whether For you is selected
