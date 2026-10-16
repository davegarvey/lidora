# qr-scanner Specification

## Purpose
Let readers pair a new device for sync by scanning a QR code or entering a code manually, with the sharing device showing a code and how long it remains valid.

## Requirements

### Requirement: Countdown ring shows code freshness

The expanded Add a device card SHALL show a countdown ring and the remaining time ("Expires in 4:12") next to the pairing code, indicating remaining code validity. The countdown SHALL NOT appear in the join card.

#### Scenario: Ring full on generation

- **WHEN** a new pairing code is generated
- **THEN** the countdown ring SHALL appear full (100% arc)

#### Scenario: Ring depletes over time

- **WHEN** time passes since code generation
- **THEN** the ring arc SHALL decrease proportionally to time remaining
- **THEN** when less than 30 seconds remain, the ring color SHALL change to red

#### Scenario: Ring resets on refresh

- **WHEN** the code auto-refreshes
- **THEN** the ring SHALL snap back to full

#### Scenario: No countdown when joining

- **WHEN** the join card is shown
- **THEN** no countdown ring or expiry text SHALL be shown

### Requirement: Scanner displays camera feed

The scanner overlay SHALL display the device camera feed in real time with a corner-bracket targeting frame to guide QR code alignment.

#### Scenario: Camera feed visible

- **WHEN** the scanner overlay opens
- **THEN** the live camera feed SHALL be displayed filling most of the viewport
- **THEN** a corner-bracket targeting frame SHALL be overlaid on the feed

#### Scenario: Camera permission denied

- **WHEN** the user denies camera permission
- **THEN** an error message SHALL be displayed explaining that camera access is needed
- **THEN** the user SHALL be offered "Try again" and "Enter code manually" options

#### Scenario: No camera available

- **WHEN** the device has no camera
- **THEN** an error message SHALL be displayed stating that no camera was found
- **THEN** the user SHALL be offered to close the scanner and enter the code manually

### Requirement: Scanner decodes QR codes

The scanner SHALL capture camera frames at regular intervals and attempt to decode QR codes using the `jsqr` library.

#### Scenario: Valid QR decoded

- **WHEN** a QR code is detected in the camera frame
- **THEN** the scanner SHALL validate that the decoded URL's origin matches `window.location.origin`
- **THEN** the scanner SHALL extract the `pair` query parameter from the validated URL
- **THEN** the scanner SHALL call `redeemCode()` with the extracted code
- **THEN** on success, the scanner SHALL close and the Devices section SHALL report that pairing succeeded

#### Scenario: QR from different origin

- **WHEN** a QR code is detected whose URL origin does not match `window.location.origin`
- **THEN** the scanner SHALL ignore the frame and continue scanning
- **THEN** the scanner SHALL NOT call `redeemCode()`

#### Scenario: QR without pair parameter

- **WHEN** a QR code is detected whose URL has no `pair` query parameter
- **THEN** the scanner SHALL ignore the frame and continue scanning

#### Scenario: Redeem fails

- **WHEN** `redeemCode()` fails (network error, expired code, rate limit)
- **THEN** the scanner SHALL display an error message with the failure reason
- **THEN** the user SHALL be offered "Try again" and "Enter code manually" options

### Requirement: Scanner can be dismissed

The scanner overlay SHALL provide a way to close it without scanning.

#### Scenario: Cancel button

- **WHEN** user taps the "Cancel" button
- **THEN** the scanner overlay SHALL close
- **THEN** the card that opened it SHALL remain as it was

#### Scenario: Escape key

- **WHEN** user presses the Escape key
- **THEN** the scanner overlay SHALL close
- **THEN** the card that opened it SHALL remain as it was
- **THEN** Settings SHALL remain open

### Requirement: Scanner cleans up resources

The scanner SHALL release all camera resources when dismissed or unmounted.

#### Scenario: Camera released on close

- **WHEN** the scanner overlay closes for any reason
- **THEN** all camera tracks SHALL be stopped
- **THEN** the video stream SHALL be released
- **THEN** the frame capture interval SHALL be cleared

### Requirement: Busy signals are separate

The pairing code generation and code redemption operations SHALL use independent busy signals so that one does not affect the other's UI state.

#### Scenario: Generating code does not affect Pair button

- **WHEN** the user clicks "Generate code" (or auto-generates)
- **THEN** the "Pair" button SHALL remain enabled and show "Pair" (not "Pairing…")

#### Scenario: Pairing does not affect Generate button

- **WHEN** the user clicks "Pair"
- **THEN** the "Generate code" button SHALL remain enabled

### Requirement: Join card provides QR scanning

The Join from another device card SHALL include a Scan icon button next to Pair. Activating it SHALL open the full-viewport camera scanner overlay above the page. The approval-code entry in the Agents section SHALL use the same overlay.

#### Scenario: Scan button available

- **WHEN** the join card is shown
- **THEN** a Scan button labelled "Scan a QR code" SHALL be visible next to Pair

#### Scenario: Scan button disabled when no camera

- **WHEN** the device has no camera
- **THEN** the Scan button SHALL be disabled
- **THEN** text in the card SHALL state that no camera was found

#### Scenario: Scanner opens on tap

- **WHEN** the user activates Scan
- **THEN** a full-viewport scanner overlay SHALL appear above the page

#### Scenario: Scanner success

- **WHEN** the scanner successfully decodes a QR code and pairing completes
- **THEN** the scanner SHALL close
- **THEN** the Devices section SHALL change to its sync-on state with the status "This device is now syncing"
