## ADDED Requirements

### Requirement: Valid library transfer

Library transfer SHALL preserve feed statistics even when their feed is no longer subscribed. It SHALL continue to reject article records and article state that refer to missing subscriptions or articles. Invalid transfer data SHALL leave the destination unchanged.

#### Scenario: Move a library with statistics from an unsubscribed feed

- **GIVEN** the source library contains statistics for a feed that is no longer subscribed
- **WHEN** the user moves the library to Lidora
- **THEN** the transfer preserves those statistics and completes without rejecting the library

#### Scenario: Reject article state without its subscription

- **GIVEN** the source library contains an article or article state without its subscription
- **WHEN** the destination validates the transfer
- **THEN** the transfer is rejected and the destination remains unchanged
