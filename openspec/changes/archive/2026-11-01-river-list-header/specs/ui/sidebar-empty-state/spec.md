# Spec Delta

## MODIFIED Requirements

### Requirement: Filter chips hidden without feeds
The sidebar SHALL not render the tag filter chips (`all` and tags) when there are no subscribed feeds.

#### Scenario: No feeds on boot
- **WHEN** the user has zero subscribed feeds and the sidebar is expanded
- **THEN** the `all` filter chip is not displayed

#### Scenario: Feeds added later
- **WHEN** the user adds their first feed
- **THEN** the filter chips appear again
