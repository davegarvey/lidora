## ADDED Requirements

### Requirement: Identify feed requests without disclosing audience size

Lidora upstream requests SHALL use one descriptive User-Agent whose version matches the application package version and whose information URL points to the public About page. The User-Agent SHALL NOT include subscriber counts or other audience-size estimates, and the application SHALL NOT offer a setting to enable them, because those counts disclose reader activity to feed publishers.

#### Scenario: Feed request identifies Lidora
- **WHEN** Lidora makes an upstream request
- **THEN** its User-Agent SHALL identify Lidora with the current package version and About URL

#### Scenario: Subscriber count is not exposed
- **WHEN** Lidora fetches a feed followed by synced accounts
- **THEN** the User-Agent SHALL NOT include the number of accounts following that URL

### Requirement: Expose permanent feed redirect destinations

When a feed request follows a 301 or 308 redirect, the proxy SHALL expose the validated final URL with the successful feed response. Every redirect destination SHALL continue to pass the existing upstream target validation.

#### Scenario: Unsafe permanent redirect
- **WHEN** a permanent redirect points to a URL that fails upstream target validation
- **THEN** Lidora SHALL reject the redirect and SHALL NOT expose or store that destination

### Requirement: Confirm permanent redirects before changing subscriptions

A local subscription URL SHALL change only after two independent upstream fetches report the same final URL through a chain containing 301 or 308. Cache hits SHALL NOT count as independent observations. Temporary redirects SHALL NOT change a subscription URL.

#### Scenario: Repeated permanent redirect
- **WHEN** two independent feed fetches for the same subscription follow 301 or 308 responses to the same validated final URL
- **THEN** the local subscription SHALL adopt that URL while retaining its stable feed ID

#### Scenario: Cached response does not confirm a redirect
- **WHEN** a feed response with redirect metadata is served from cache
- **THEN** the response SHALL NOT count as a new redirect observation

#### Scenario: Temporary redirect
- **WHEN** a feed fetch follows only temporary redirects
- **THEN** the subscription URL SHALL remain unchanged

