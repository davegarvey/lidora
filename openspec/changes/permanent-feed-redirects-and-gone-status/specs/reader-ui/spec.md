## ADDED Requirements

### Requirement: Identify feeds removed by their publisher

When a feed request receives HTTP 410, the reader SHALL mark the feed as removed, SHALL NOT retry it automatically, and SHALL identify its removed state to the user. The feed editor SHALL explain that the publisher returned HTTP 410 and provide an unsubscribe action. Changing the feed URL SHALL clear the removed state.

#### Scenario: Feed returns 410
- **WHEN** an upstream feed returns HTTP 410
- **THEN** the reader SHALL show that the publisher removed the feed
- **AND** automatic refresh SHALL stop until the URL changes or the user unsubscribes
- **AND** the feed editor SHALL offer unsubscribe

#### Scenario: Removed feed gets a new URL
- **WHEN** the user changes the URL of a feed marked removed
- **THEN** the removed state SHALL clear
- **AND** refresh SHALL resume for the new URL
