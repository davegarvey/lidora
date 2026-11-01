# for-you-article-order Specification

## Purpose
Let readers optionally reorder the articles already eligible in their selected scope using recent feed reading patterns, recency and direct feed preferences.

## Requirements

### Requirement: Optional For you article order

The app SHALL offer Latest and For you ordering for the current article list. Latest SHALL remain the default and SHALL preserve newest-first order. The selected order SHALL persist locally on this device and SHALL be independent of the active feed, tag, read and starred filters.

#### Scenario: Latest is the default
- **WHEN** no article order preference has been saved
- **THEN** eligible articles SHALL appear newest first

#### Scenario: For you selection survives scope changes
- **WHEN** the reader selects For you and changes the active feed, tags, read mode or starred filter
- **THEN** For you SHALL remain selected and SHALL order only articles that match the new scope

#### Scenario: Article order is local to this device
- **WHEN** the reader changes the article order while sync is enabled
- **THEN** the preference SHALL be saved on this device
- **AND** it SHALL NOT be sent to or read from the sync service

### Requirement: Quiet ordering control

The Latest and For you control SHALL be a single icon toggle (Lucide `ArrowDownWideNarrow`) in the article list header. Pressed SHALL mean For you; unpressed SHALL mean Latest. Its accessible name and tooltip SHALL state the current order. It SHALL NOT appear in the sidebar chips, the mobile sidebar drawer or the collapsed desktop rail. It SHALL be accessible by pointer, keyboard and touch and expose its pressed state to assistive technology.

#### Scenario: Choose an order without obscuring articles
- **WHEN** the article list is shown on desktop or mobile
- **THEN** the reader SHALL be able to switch between Latest and For you from the list header
- **AND** the control SHALL NOT appear among the sidebar tag chips

#### Scenario: Selected order is announced
- **WHEN** a screen reader focuses the ordering control
- **THEN** it SHALL announce that the control sets the article order and whether For you is selected

### Requirement: Recent feed reading preference

For you SHALL estimate feed preference from the read-through rate of a recent, mature cohort of locally observed articles, smoothed toward the all-feed rate when the cohort is small. The estimate SHALL use feed-relative rates rather than raw article or read counts.

#### Scenario: Compare feeds with different volumes
- **WHEN** a high-volume feed has a lower recent read-through rate than a quieter feed
- **THEN** high volume alone SHALL NOT give it a higher feed preference

#### Scenario: Small recent cohort
- **WHEN** a feed has too few mature articles to estimate a stable recent rate
- **THEN** its estimate SHALL be pulled toward the all-feed rate rather than treated as an extreme preference

#### Scenario: New articles have time to be read
- **WHEN** an article is too new to belong to the mature preference cohort
- **THEN** it SHALL NOT count as an unread preference signal solely because it has not yet been read

### Requirement: Recency-aware, feed-balanced ordering

For you SHALL order only eligible articles. It SHALL balance article recency and feed preference, preserve newest-first order within each feed, and mix articles across feeds so a prolific feed cannot occupy the list solely through volume. Direct feed preference SHALL have a bounded effect and SHALL NOT make old articles remain prominent indefinitely.

#### Scenario: Less frequent preferred feed remains visible
- **GIVEN** a quiet feed has a stronger reading preference than a prolific feed
- **WHEN** both feeds have eligible recent articles
- **THEN** For you SHALL give the quiet feed meaningful representation near the top of the list
- **AND** it SHALL not simply sort all articles by publication date

#### Scenario: Per-feed chronology is preserved
- **WHEN** a feed has multiple eligible articles in For you
- **THEN** its newer article SHALL appear before its older article

#### Scenario: Recency limits old articles
- **WHEN** an eligible article is substantially older than other eligible articles
- **THEN** feed preference SHALL NOT keep it near the top indefinitely

### Requirement: Feed-level thumb feedback

Thumb controls shown with an article SHALL set a direct preference for that article's feed, not a rating or visibility state for that article alone. The controls SHALL be labelled More from [feed] and Less from [feed], SHALL affect For you only, and SHALL leave Latest and article eligibility unchanged. Selecting an active preference again SHALL clear it.

#### Scenario: Prefer a feed from one of its articles
- **WHEN** the reader selects the thumbs-up control on an article
- **THEN** the feed SHALL receive the More preference
- **AND** the control's accessible label SHALL identify that feed

#### Scenario: De-emphasize a feed from one of its articles
- **WHEN** the reader selects the thumbs-down control on an article
- **THEN** the feed SHALL receive the Less preference
- **AND** its eligible articles SHALL remain available in Latest

#### Scenario: Clear a feed preference
- **WHEN** the reader activates the currently selected thumbs-up or thumbs-down control for a feed
- **THEN** that feed's direct preference SHALL return to neutral

#### Scenario: Feed preference is consistent across articles
- **WHEN** a direct preference exists for a feed
- **THEN** its selected state SHALL be represented consistently on that feed's articles in the river and reading view

#### Scenario: Feed feedback is local
- **WHEN** the reader sets a direct feed preference while sync is enabled
- **THEN** it SHALL be saved on this device
- **AND** it SHALL NOT be sent to or read from the sync service

### Requirement: For you works with limited reading history

When recent reading history is unavailable or insufficient, For you SHALL remain usable by falling back toward Latest ordering. It SHALL NOT hide eligible articles or require a network request to rank the local library.

#### Scenario: New reader selects For you
- **WHEN** the reader selects For you before enough reading history exists
- **THEN** eligible articles SHALL remain available
- **AND** the order SHALL be close to Latest until a preference signal is available

#### Scenario: Offline ranking
- **WHEN** the reader selects For you while offline
- **THEN** the order SHALL be calculated from locally available article and preference data
- **AND** no network request SHALL be required
