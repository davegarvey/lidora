## ADDED Requirements

### Requirement: Public pages match the reader

The About, Privacy and Terms pages SHALL use the reader's Catppuccin Latte palette in light mode and Mocha palette in dark mode, following the system colour scheme. They SHALL show the reader's italic serif wordmark linking to `/`, an "Open reader" link to `/`, and a footer linking to About, Privacy and Terms with the current page marked. They SHALL NOT require JavaScript.

#### Scenario: Dark mode page content is legible

- **WHEN** a visitor with a dark colour scheme opens `/about`
- **THEN** the page background, text, links and card SHALL use Mocha colours

#### Scenario: Visitor returns to the reader

- **WHEN** a visitor selects the wordmark or "Open reader"
- **THEN** the browser SHALL navigate to `/`

### Requirement: Settings links to public pages

The Settings footer SHALL link to `/about`, `/privacy` and `/terms`.

#### Scenario: Reader opens About from Settings

- **WHEN** a reader opens Settings
- **THEN** the footer SHALL include About, Privacy and Terms links

### Requirement: Reader shell is crawlable

The reader's HTML document SHALL contain static content naming Sift, describing it in one sentence and linking to `/about`. The reader SHALL remove this content before mounting. The site SHALL publish `/sitemap.xml` listing `/`, `/about`, `/privacy` and `/terms`, and `robots.txt` SHALL reference it.

#### Scenario: Crawler without JavaScript reads the root

- **WHEN** a client fetches `/` without running scripts
- **THEN** the response SHALL include the description and a link to `/about`

#### Scenario: Reader mounts

- **WHEN** the reader script runs
- **THEN** the static content SHALL be removed before the reader renders
