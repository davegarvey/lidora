## MODIFIED Requirements

### Requirement: Cap proxy response bodies

`/feed` SHALL return at most 8 MiB, `/article` at most 5 MiB and `/img` at most 10 MiB of upstream body. When the upstream declares a `Content-Length` over the cap, the proxy SHALL cancel the upstream body without reading it and return `502` with `Cache-Control: no-store`. When a body without a declared length, or with a misleading one, exceeds the cap while streaming, the proxy SHALL stop reading the upstream body at the cap without buffering the whole body. A streamed oversize feed SHALL return `502`; a streamed oversize article or image SHALL error the response stream. The feed cache SHALL NOT buffer or retain more than 8 MiB for one response.

#### Scenario: Declared oversize feed is rejected

- **WHEN** an upstream feed response declares a `Content-Length` over 8 MiB
- **THEN** the proxy SHALL cancel the upstream body without reading it
- **AND** return `502` with `Cache-Control: no-store` and the endpoint's isolation headers

#### Scenario: Declared oversize article is rejected

- **WHEN** an upstream article response declares a `Content-Length` over 5 MiB
- **THEN** the proxy SHALL return `502` with `Cache-Control: no-store` and the endpoint's isolation headers
- **AND** the response SHALL NOT contain the upstream body

#### Scenario: Declared oversize image is rejected

- **WHEN** an upstream image response declares a `Content-Length` over 10 MiB
- **THEN** the proxy SHALL return `502` with `Cache-Control: no-store` and the endpoint's isolation headers

#### Scenario: Streamed oversize feed is rejected without full buffering

- **WHEN** an upstream feed body without a trustworthy `Content-Length` exceeds 8 MiB
- **THEN** the proxy SHALL stop reading it as soon as the cap is exceeded
- **AND** return `502` without retaining or forwarding the body

#### Scenario: Streamed oversize article or image is aborted

- **WHEN** an upstream article or image body without a trustworthy `Content-Length` exceeds its cap while streaming
- **THEN** the proxy SHALL error the response stream at the cap
- **AND** it SHALL stop reading the upstream body

#### Scenario: Large feed within the cap is delivered

- **WHEN** an upstream feed body is larger than 2 MiB and no larger than 8 MiB
- **THEN** the proxy SHALL deliver it in full

#### Scenario: Body at the cap is delivered

- **WHEN** an upstream body is exactly the cap size
- **THEN** the proxy SHALL deliver it in full

