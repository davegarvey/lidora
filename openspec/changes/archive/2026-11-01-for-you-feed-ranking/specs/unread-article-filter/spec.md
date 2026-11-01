# Spec Delta

## MODIFIED Requirements

### Requirement: Filter before limiting results

Item queries SHALL apply feed/tag scope, effective read mode and starred eligibility before the 500-item result limit. Latest SHALL order eligible articles newest first. For you SHALL apply its feed-balanced order to eligible candidates before limiting the displayed results. The retained current reading row SHALL NOT displace an eligible unread result. Reading navigation SHALL use the same ordered eligible articles as the visible list.

#### Scenario: Older unread articles behind read articles
- **GIVEN** the latest 500 stored articles are read and an older matching article is unread
- **WHEN** Unread is selected
- **THEN** the older matching article SHALL be available in the list

#### Scenario: For you applies eligibility before ordering and limiting
- **GIVEN** the selected feeds contain read, unread and starred articles
- **WHEN** For you is active with Unread selected
- **THEN** only unread articles from the selected feeds SHALL be ranked
- **AND** the result limit SHALL be applied after For you orders its eligible candidates

#### Scenario: For you includes a quiet selected feed in candidate selection
- **GIVEN** multiple selected feeds contain eligible articles and one publishes much less often
- **WHEN** For you builds its bounded candidate set
- **THEN** it SHALL consider an eligible article from each selected feed before the overall result limit can be filled by a prolific feed

#### Scenario: Navigation follows For you order
- **GIVEN** For you is active and an article is open
- **WHEN** the reader moves to the next or previous article
- **THEN** navigation SHALL follow the same ordered eligible articles as the visible list

#### Scenario: Latest remains chronological
- **WHEN** Latest is active
- **THEN** eligible articles SHALL appear newest first
