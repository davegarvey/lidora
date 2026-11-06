## MODIFIED Requirements

### Requirement: Zero-feed welcome state

When the user has no subscriptions and the river has no items, the river SHALL show a welcome that explains Lidora briefly and states that the local library stays in the browser without an account. It SHALL offer three actions: add a feed, subscribe to the curated sample feeds and open Settings for OPML import. Each action SHALL be a row with an icon and label; on desktop each row SHALL also carry a short note saying when the action applies. Only the add-feed action SHALL use the accent colour. Below the actions, a single line for readers who already use Lidora in another browser SHALL open Settings to pair a device. The welcome SHALL link to About. It SHALL fill the river: on desktop it SHALL be a left-aligned column centred in the river, and on mobile its action rows SHALL sit at the bottom of the screen. Existing readers with subscriptions SHALL never see this welcome state.

#### Scenario: Fresh install

- **WHEN** IndexedDB has no subscribed feeds and the app has hydrated
- **THEN** the river SHALL show the Lidora welcome and the three actions and the pairing line
- **AND** activating Add a feed SHALL open the add-feed modal
- **AND** activating Try sample feeds SHALL subscribe to the curated feeds as ordinary removable subscriptions
- **AND** the About link SHALL open `/about`

#### Scenario: Desktop layout

- **WHEN** the welcome is shown on a desktop-width viewport
- **THEN** it SHALL be vertically centred in the river rather than placed at its top
- **AND** each action row SHALL show a note saying when the action applies

#### Scenario: Mobile layout

- **WHEN** the welcome is shown on a mobile-width viewport
- **THEN** the headline SHALL sit near the top of the river and the action rows near the bottom

#### Scenario: Reader already has subscriptions

- **WHEN** at least one feed is subscribed
- **THEN** the zero-feed welcome SHALL not be shown

#### Scenario: OPML import or device pairing

- **WHEN** the visitor chooses Import OPML or the pairing line
- **THEN** Settings SHALL open with the relevant subscription or sync controls available
