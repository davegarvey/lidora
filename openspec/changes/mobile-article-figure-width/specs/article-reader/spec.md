## ADDED Requirements

### Requirement: Article figures use the full reading column on mobile

In the mobile reading view, article figures SHALL use the full width of the padded reading column without the browser's default horizontal figure margins. The article body's existing horizontal padding SHALL remain in effect, and desktop figure spacing SHALL remain unchanged.

#### Scenario: Figure content on mobile

- **WHEN** an article containing a `figure` is displayed at a viewport width of 768 CSS pixels or narrower
- **THEN** the figure has no horizontal margin
- **AND** its content can use the full width inside the reading body's existing horizontal padding

#### Scenario: Figure spacing on desktop

- **WHEN** an article containing a `figure` is displayed at a viewport width wider than 768 CSS pixels
- **THEN** the existing desktop figure spacing remains unchanged
