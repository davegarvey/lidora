## ADDED Requirements

### Requirement: Full feed content retains its effective XML base

The parser SHALL retain the effective XML base URI with full feed content, honoring inherited `xml:base` values and using the feed document URL when no base is declared.

#### Scenario: Content declares its own XML base

- **WHEN** an Atom entry's content declares `xml:base="https://example.com/posts/one/"`
- **THEN** the stored body SHALL retain `https://example.com/posts/one/` as its base URL

#### Scenario: Content inherits its base from the entry or feed

- **WHEN** Atom content has no `xml:base` of its own and the entry or feed declares one
- **THEN** the stored body base SHALL resolve against the nearest inherited effective base

#### Scenario: Content has no declared XML base

- **WHEN** feed-provided full HTML has no applicable `xml:base`
- **THEN** the stored body base SHALL be the feed document URL

### Requirement: Remote feed article images use the image proxy

The reader SHALL resolve remote image URLs against the full content's effective XML base and route valid HTTP(S) image sources through `/img?url=`. Existing proxy URLs SHALL remain unchanged; malformed and non-HTTP(S) sources SHALL be omitted.

#### Scenario: Atom content has a root-relative image

- **WHEN** feed content based at `https://example.com/posts/one/` contains `<img src="/assets/chart.svg">`
- **THEN** the rendered image source SHALL be the `/img?url=` proxy for `https://example.com/assets/chart.svg`

#### Scenario: Responsive image candidates are proxied

- **WHEN** feed HTML contains `img[srcset]` or `picture source[srcset]` with relative or absolute HTTP(S) candidates
- **THEN** every valid candidate URL SHALL be resolved against the effective content base and rewritten through `/img?url=` while preserving its descriptor

#### Scenario: Existing proxy image remains stable

- **WHEN** a full feed body or extracted body already contains an `/img?url=` image URL
- **THEN** the reader SHALL preserve that URL without wrapping it in another proxy URL

#### Scenario: Invalid image source is omitted

- **WHEN** an image source candidate is malformed or uses a non-HTTP(S) scheme
- **THEN** that candidate SHALL be omitted from the rendered image sources
