## ADDED Requirements

### Requirement: Article HTML is sanitised before rendering

The reading view SHALL pass every article body through an allowlist HTML sanitiser immediately before inserting it into the page. The sanitiser SHALL remove `script`, `style`, `form`, `object`, `svg` and `math` elements, every event-handler attribute, `id`, `class` and `name` attributes, and URLs with a `javascript:` scheme. It SHALL keep `figure`, `figcaption`, `picture`, `source`, `img` (with `src`, `srcset`, `alt`, `width`, `height` and `data-original-src`), `strong`, `em`, `small`, `b`, `i`, headings, lists, `blockquote`, `pre`, `code`, tables, and links with `href`, `target` and `rel`. Relative `/img?url=` proxy URLs SHALL be preserved. Inline `style` SHALL be kept only on `img`, `iframe`, `video` and `embed`. An `iframe` or `embed` SHALL be removed unless its `src` is an absolute `http:` or `https:` URL. Any element with a `target` SHALL render with `target="_blank"` and `rel="noopener noreferrer"`.

#### Scenario: Inline event handler in an extracted image

- **WHEN** a body containing `<img src="/img?url=x" onerror="alert(1)">` is rendered
- **THEN** the image is rendered with its proxy `src`
- **AND** it has no `onerror` attribute

#### Scenario: Script and style elements

- **WHEN** a body contains `script` or `style` elements
- **THEN** neither the elements nor their contents are rendered

#### Scenario: Figure markup

- **WHEN** a body contains a `figure` with a `picture`, `source` elements, a proxied `img` with `srcset`, `alt`, `width`, `height` and `data-original-src`, and a formatted `figcaption`
- **THEN** the rendered markup is unchanged

#### Scenario: Fitted media embed

- **WHEN** a body contains an `iframe` with an absolute `https:` `src` and the inline style written by media fitting
- **THEN** the iframe and its style are rendered unchanged

#### Scenario: Same-origin frame

- **WHEN** a body contains an `iframe` whose `src` is relative or uses a non-HTTP scheme
- **THEN** the iframe is not rendered

### Requirement: Article bodies are sanitised before storage

Feed HTML written by `bulkUpsertItems` and Readability output written by `saveExtractedHtml` SHALL be passed through the same sanitiser before they are stored in `itemBodies`. Bodies stored before this requirement SHALL NOT be rewritten in place; render-time sanitisation covers them until a refresh or a new extraction replaces them.

#### Scenario: Feed HTML with an event handler

- **WHEN** a refresh stores feed HTML containing `<p onclick="alert(1)">`
- **THEN** the stored `html` contains the paragraph without the `onclick` attribute

#### Scenario: Extraction with a javascript: link

- **WHEN** an extraction containing `<a href="javascript:alert(1)">` is saved
- **THEN** the stored `extractedHtml` contains the link without the `href`
