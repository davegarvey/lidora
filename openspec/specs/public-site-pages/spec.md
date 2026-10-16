# public-site-pages Specification

## Purpose
Give visitors clear, crawlable information about Sift and its privacy and usage terms, while keeping those pages available from the hosted reader and installed PWA.

## Requirements

### Requirement: Static information pages are available to visitors

The hosted site SHALL serve crawlable About, Privacy and Terms pages at `/about`, `/privacy` and `/terms`. Each page SHALL work in the Workers, Node, Bun and Vite development adapters and provide navigation back to the reader. The service worker SHALL NOT replace navigation to these routes with the reader app shell.

#### Scenario: Visitor opens a public information page

- **WHEN** a visitor navigates directly to `/about`, `/privacy` or `/terms`
- **THEN** the server SHALL return the matching HTML document without first loading the SolidJS reader
- **AND** the page SHALL include a link back to `/`

#### Scenario: Installed reader opens a public information page

- **WHEN** an installed reader navigates to `/about`, `/privacy` or `/terms`
- **THEN** the service worker SHALL allow the request to reach the matching static page

#### Scenario: Legal pages are ready to publish

- **WHEN** Privacy and Terms are deployed
- **THEN** their storage, deletion, retention, provider and proxy statements SHALL match the implementation
- **AND** both SHALL include the operator's real forwarding contact address

### Requirement: Public pages match the reader

The About, Privacy and Terms pages SHALL use the reader's Catppuccin Latte palette in light mode and Mocha palette in dark mode, following the system colour scheme. They SHALL show the reader's italic serif wordmark linking to `/`, an "Open reader" link to `/`, and a footer linking to About, Privacy and Terms with the current page marked. They SHALL NOT require JavaScript.

#### Scenario: Dark mode page content is legible

- **WHEN** a visitor with a dark colour scheme opens `/about`
- **THEN** the page background, text, links and card SHALL use Mocha colours

#### Scenario: Visitor returns to the reader

- **WHEN** a visitor selects the wordmark or "Open reader"
- **THEN** the browser SHALL navigate to `/`

### Requirement: Settings links to public pages

The About section of Settings SHALL link to `/about`, `/privacy` and `/terms`.

#### Scenario: Reader opens About from Settings

- **WHEN** a reader opens the About section of Settings
- **THEN** it SHALL include About, Privacy and Terms links

### Requirement: Reader shell is crawlable

The reader's HTML document SHALL contain static content naming Sift, describing it in one sentence and linking to `/about`. The reader SHALL remove this content before mounting. The site SHALL publish `/sitemap.xml` listing `/`, `/about`, `/privacy` and `/terms`, and `robots.txt` SHALL reference it.

#### Scenario: Crawler without JavaScript reads the root

- **WHEN** a client fetches `/` without running scripts
- **THEN** the response SHALL include the description and a link to `/about`

#### Scenario: Reader mounts

- **WHEN** the reader script runs
- **THEN** the static content SHALL be removed before the reader renders
