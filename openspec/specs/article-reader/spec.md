# article-reader Specification

## Purpose
Keep articles readable in the reading view by fitting embedded media to the reading column, and by treating feed HTML that carries a `Source` link to the item's own article as partial content, so the full article is extracted instead.

## Requirements

### Requirement: Embedded media SHALL fit the reading column width

During extraction, each `iframe`, `video`, and `embed` element SHALL be normalized so it renders within the reading column width without horizontal overflow, preserving its intrinsic aspect ratio. When the element has `width`/`height` attributes, the extracted element SHALL carry an inline style of `width:100%;height:auto;aspect-ratio:<w>/<h>`. When attributes are absent, the element SHALL fall back to `aspect-ratio:16/9`. In addition, the reading view CSS SHALL constrain `iframe`, `video`, and `embed` to `max-width:100%` as a safety net for any media the extractor does not process.

#### Scenario: Article contains a YouTube embed with width/height attributes

- **WHEN** extraction processes an article containing an `<iframe>` with `width="560"` and `height="315"`
- **THEN** the extracted iframe has inline `style="width:100%;height:auto;aspect-ratio:560/315"`
- **AND** the iframe renders fully inside the reading column with no horizontal overflow

#### Scenario: Embedded media without dimensions

- **WHEN** extraction processes an `<iframe>` or `<video>` with no `width`/`height` attributes
- **THEN** the element falls back to `aspect-ratio:16/9` with `width:100%;height:auto`

#### Scenario: Media not processed by the extractor

- **WHEN** the reading view renders article HTML containing an `iframe`, `video`, or `embed` that the extractor did not normalize
- **THEN** the CSS `max-width:100%` rule prevents it from overflowing the viewport

### Requirement: Self-referential source links identify partial feed content

When feed HTML contains a link labeled `Source` that resolves to the item's own article URL, the feed parser SHALL classify the HTML as partial content so the reader can use the article extraction path. A `Source` link to a different URL SHALL NOT by itself classify otherwise complete feed HTML as partial.

#### Scenario: Quanta-style source link
- **WHEN** an entry's feed HTML contains a short body and a `Source` link to the entry's article URL
- **THEN** the parser SHALL not store that HTML as full article content
- **AND** the reader SHALL be able to request full-text extraction from the article URL

#### Scenario: External source link
- **WHEN** complete feed HTML contains a `Source` link to a different URL
- **THEN** the parser SHALL not classify the HTML as partial solely because of that label

#### Scenario: Existing full-article CTA
- **WHEN** feed HTML ends with an existing full-article CTA such as `Read full article`
- **THEN** the parser SHALL continue to classify the HTML as partial content

### Requirement: Article figures use the full reading column on mobile

In the mobile reading view, article figures SHALL use the full width of the padded reading column without the browser's default horizontal figure margins. The article body's existing horizontal padding SHALL remain in effect, and desktop figure spacing SHALL remain unchanged.

#### Scenario: Figure content on mobile

- **WHEN** an article containing a `figure` is displayed at a viewport width of 768 CSS pixels or narrower
- **THEN** the figure has no horizontal margin
- **AND** its content can use the full width inside the reading body's existing horizontal padding

#### Scenario: Figure spacing on desktop

- **WHEN** an article containing a `figure` is displayed at a viewport width wider than 768 CSS pixels
- **THEN** the existing desktop figure spacing remains unchanged

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
