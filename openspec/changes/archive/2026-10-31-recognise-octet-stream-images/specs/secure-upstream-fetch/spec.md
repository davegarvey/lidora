## MODIFIED Requirements

### Requirement: Image proxy serves only images

`/img` SHALL return a successful upstream body only when the upstream response declares a `Content-Type` beginning with `image/`, or when it declares `application/octet-stream` and the body begins with a recognized image file signature. For the latter case, the proxy SHALL set the response `Content-Type` to the detected image type. Otherwise it SHALL return `502` with `Cache-Control: no-store` and SHALL NOT return the upstream body.

#### Scenario: Non-image upstream is refused

- **WHEN** `/img?url=` targets a resource served as `text/html`, unrecognized `application/octet-stream`, or with no content type
- **THEN** the proxy SHALL return `502` with `Cache-Control: no-store`
- **AND** the response SHALL NOT contain the upstream body

#### Scenario: Generic binary WebP is allowed when its signature is valid

- **WHEN** `/img?url=` targets a valid WebP image served as `application/octet-stream`
- **THEN** the proxy SHALL return the image body with `Content-Type: image/webp`
- **AND** the image isolation headers SHALL be present

#### Scenario: SVG image is allowed

- **WHEN** `/img?url=` targets a resource served as `image/svg+xml`
- **THEN** the proxy SHALL return it with its declared type and the image isolation headers
