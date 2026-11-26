## MODIFIED Requirements

### Requirement: Fire catch-up on idle→active transition

The system SHALL detect each transition from idle to active and notify every registered catch-up subscriber once per transition, on the first interaction after an idle period. Subscribers SHALL remain registered across transitions until they unsubscribe. The application's catch-up SHALL run a sync pull if stale, refresh due feeds and reload items.

#### Scenario: First mouse move after being idle
- **WHEN** the user moves the mouse after more than 5 minutes of inactivity
- **THEN** the system SHALL trigger `pullIfStale`, a due-feed refresh and `reloadItems()` exactly once
- **AND** subsequent DOM events SHALL NOT trigger additional catch-ups until the next idle→active transition

#### Scenario: Second idle period in the same page load
- **WHEN** the user returns from idle, becomes idle again, and returns again
- **THEN** a catch-up SHALL run on each return

## ADDED Requirements

### Requirement: Pause automatic refreshes while idle

The scheduler SHALL NOT start automatic feed refreshes or scheduled sync pulls while the user is idle or the page is hidden. Returning to a visible page after more than 5 minutes away, when the user was not idle at hide, SHALL pull if stale and then refresh due feeds.

#### Scenario: Window left open overnight
- **WHEN** a visible window receives no interaction for 5 minutes
- **THEN** later scheduler ticks and due timers SHALL make no `/feed` or `/sync/` requests until the user interacts again

#### Scenario: Return after a break
- **WHEN** the user interacts after an idle period during which feeds became due
- **THEN** the catch-up SHALL refresh those feeds
