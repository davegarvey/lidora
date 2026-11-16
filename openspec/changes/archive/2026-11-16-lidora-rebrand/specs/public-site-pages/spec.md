## MODIFIED Requirements

### Requirement: Reader shell is crawlable

The reader's HTML document SHALL contain static content naming Lidora, describing it in one sentence and linking to `/about`. The reader SHALL remove this content before mounting. The site SHALL publish `/sitemap.xml` listing `/`, `/about`, `/privacy` and `/terms`, and `robots.txt` SHALL reference it.

#### Scenario: Crawler without JavaScript reads the root

- **WHEN** a client fetches `/` without running scripts
- **THEN** the response SHALL include the description and a link to `/about`

#### Scenario: Reader mounts

- **WHEN** the reader script runs
- **THEN** the static content SHALL be removed before the reader renders
