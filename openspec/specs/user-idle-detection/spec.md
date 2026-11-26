# user-idle-detection Specification

## Purpose
Detect when the reader is idle or active from DOM activity events, so missed updates can be fetched when they return.

## Requirements

### Requirement: Detect user idle state

The system SHALL track user activity via DOM interaction events and expose an `isIdle()` function that returns `true` when no activity has been detected for 5 minutes.

#### Scenario: User is actively using the app
- **WHEN** the user moves the mouse, presses a key, scrolls, clicks, touches, or uses the mouse wheel within the last 5 minutes
- **THEN** `isIdle()` SHALL return `false`

#### Scenario: User walks away from the computer
- **WHEN** no DOM interaction events fire for 5 consecutive minutes
- **THEN** `isIdle()` SHALL return `true`

#### Scenario: User returns after idle period
- **WHEN** the first DOM interaction event fires after an idle period
- **THEN** `isIdle()` SHALL return `false` immediately after the event is processed

### Requirement: Fire catch-up on idle→active transition

The system SHALL detect each transition from idle to active and notify every registered catch-up subscriber once per transition, on the first interaction after an idle period. Subscribers SHALL remain registered across transitions until they unsubscribe. The application's catch-up SHALL run a sync pull if stale, refresh due feeds and reload items.

#### Scenario: First mouse move after being idle
- **WHEN** the user moves the mouse after more than 5 minutes of inactivity
- **THEN** the system SHALL trigger `pullIfStale`, a due-feed refresh and `reloadItems()` exactly once
- **AND** subsequent DOM events SHALL NOT trigger additional catch-ups until the next idle→active transition

#### Scenario: Second idle period in the same page load
- **WHEN** the user returns from idle, becomes idle again, and returns again
- **THEN** a catch-up SHALL run on each return

### Requirement: Track activity via DOM events

The system SHALL listen to the following events on `document` with `passive: true`: `mousemove`, `mousedown`, `keydown`, `scroll` (with `capture: true`), `touchstart`, `click`, `wheel`, `pointerdown`.

#### Scenario: Scroll events from page content
- **WHEN** the user scrolls the river or any scrollable element in the page
- **THEN** the `scroll` event listener SHALL fire and reset the activity timestamp

#### Scenario: Activity detection with stylus
- **WHEN** a user interacts with a stylus or pointer device
- **THEN** the `pointerdown` event SHALL reset the activity timestamp

### Requirement: Pause automatic refreshes while idle

The scheduler SHALL NOT start automatic feed refreshes or scheduled sync pulls while the user is idle or the page is hidden. Returning to a visible page after more than 5 minutes away, when the user was not idle at hide, SHALL pull if stale and then refresh due feeds.

#### Scenario: Window left open overnight
- **WHEN** a visible window receives no interaction for 5 minutes
- **THEN** later scheduler ticks and due timers SHALL make no `/feed` or `/sync/` requests until the user interacts again

#### Scenario: Return after a break
- **WHEN** the user interacts after an idle period during which feeds became due
- **THEN** the catch-up SHALL refresh those feeds
