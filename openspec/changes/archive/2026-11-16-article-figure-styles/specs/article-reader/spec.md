## ADDED Requirements

### Requirement: Article figures use standard element styles

The reading view SHALL style article figures by standard element, without site-specific classes, using the theme tokens. A `figure` SHALL have vertical spacing and no horizontal margin at every viewport width. An image inside it SHALL be centred and scale down to the column width with automatic height, without being enlarged beyond its natural size. A `figcaption` SHALL use the interface sans-serif font, a smaller size than body text and the muted text colour.

#### Scenario: Figure with title, image and caption

- **WHEN** an article contains a `figure` with a bold title paragraph, an `img` and a `figcaption`
- **THEN** the figure has no horizontal margin
- **AND** the image is no wider than the figure, with its aspect ratio preserved
- **AND** the caption uses the sans-serif font, a smaller size than body text and the muted text colour
- **AND** the title keeps its bold weight

#### Scenario: Figure on desktop

- **WHEN** an article containing a `figure` is displayed at a viewport width wider than 768 CSS pixels
- **THEN** the figure has no horizontal margin

#### Scenario: Image narrower than the column

- **WHEN** a `figure` contains an image whose natural width is less than the reading column
- **THEN** the image renders at its natural width, centred, and is not enlarged

## REMOVED Requirements

### Requirement: Article figures use the full reading column on mobile
**Reason**: Replaced by "Article figures use standard element styles", which removes horizontal figure margins at every width and adds image and caption styles.
**Migration**: None. The mobile behaviour is unchanged.
