import createDOMPurify, { type DOMPurify } from 'dompurify';

const ALLOWED_TAGS = [
  'a', 'abbr', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'br', 'caption', 'cite', 'code',
  'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'embed', 'figcaption', 'figure',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'iframe', 'img', 'ins', 'kbd', 'li',
  'mark', 'ol', 'p', 'picture', 'pre', 'q', 's', 'samp', 'section', 'small', 'source', 'span', 'strong',
  'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'track', 'u', 'ul',
  'var', 'video', 'wbr',
];

const ALLOWED_ATTR = [
  'abbr', 'allow', 'allowfullscreen', 'alt', 'cite', 'colspan', 'controls', 'data-original-src', 'datetime',
  'decoding', 'dir', 'frameborder', 'headers', 'height', 'href', 'kind', 'label', 'lang', 'loading', 'loop',
  'media', 'muted', 'open', 'playsinline', 'poster', 'preload', 'referrerpolicy', 'rel', 'reversed', 'rowspan',
  'scope', 'sizes', 'span', 'src', 'srclang', 'srcset', 'start', 'style', 'target', 'title', 'type', 'value',
  'width',
];

const STYLED_TAGS = new Set(['IMG', 'IFRAME', 'VIDEO', 'EMBED']);
const FRAMED_TAGS = new Set(['IFRAME', 'EMBED']);

function isRemoteUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

let purifier: DOMPurify | undefined;

function getPurifier(): DOMPurify {
  if (purifier) return purifier;
  if (typeof window === 'undefined') throw new Error('sanitiseArticleHtml requires a DOM');
  const instance = createDOMPurify(window);
  if (!instance.isSupported) throw new Error('sanitiseArticleHtml requires a DOM');
  instance.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style' && !STYLED_TAGS.has(node.nodeName)) data.keepAttr = false;
  });
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof window.Element)) return;
    if (FRAMED_TAGS.has(node.nodeName) && !isRemoteUrl(node.getAttribute('src'))) {
      node.remove();
      return;
    }
    if (node.hasAttribute('target')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  purifier = instance;
  return instance;
}

/**
 * Reduce untrusted article HTML (feed bodies, Readability extractions,
 * excerpts) to an allowlist of presentational markup. Removes scripts,
 * styles, forms, event-handler attributes, `id`/`class`/`name`, and
 * `javascript:` URLs; keeps inline `style` only on media elements; drops
 * frames whose `src` is not an absolute http(s) URL.
 */
export function sanitiseArticleHtml(html: string): string {
  return getPurifier().sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
