// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitiseArticleHtml } from '../src/articles/sanitise';
import { fitMediaElements } from '../src/articles/extract';

function parse(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(sanitiseArticleHtml(html), 'text/html');
  return doc.body;
}

describe('sanitiseArticleHtml', () => {
  it('strips inline event handlers', () => {
    const body = parse(
      '<p onclick="alert(1)">Hi</p><img src="x" onerror="alert(1)"><a href="https://a.test/" onmouseover="alert(1)">x</a>',
    );
    expect(body.innerHTML).not.toMatch(/on(click|error|mouseover)/i);
    expect(body.querySelector('img')?.getAttribute('src')).toBe('x');
    expect(body.querySelector('p')?.textContent).toBe('Hi');
  });

  it('removes script, style, form and object elements with their contents', () => {
    const body = parse(
      '<p>a</p><script>alert(1)</script><style>body{display:none}</style><form action="/x"><input name="k"></form><object data="x"></object><svg onload="alert(1)"></svg>',
    );
    expect(body.querySelector('script, style, form, input, object, svg')).toBeNull();
    expect(body.textContent).toBe('a');
  });

  it('removes javascript: URLs', () => {
    const body = parse('<a href="javascript:alert(1)">x</a><a href=" JaVaScRiPt:alert(1)">y</a><img src="javascript:alert(1)">');
    for (const el of Array.from(body.querySelectorAll('a, img'))) {
      expect(el.getAttribute('href') ?? el.getAttribute('src') ?? '').not.toMatch(/javascript:/i);
    }
  });

  it('drops id, class, name and arbitrary data attributes', () => {
    const body = parse('<div id="root" class="modal" name="x" data-foo="1" data-original-src="https://a.test/i.png">t</div>');
    const div = body.querySelector('div')!;
    expect(div.getAttributeNames()).toEqual(['data-original-src']);
  });

  it('keeps inline style only on media elements', () => {
    const body = parse('<p style="position:fixed;inset:0">t</p><img src="/img?url=x" style="max-width:100%">');
    expect(body.querySelector('p')?.hasAttribute('style')).toBe(false);
    expect(body.querySelector('img')?.getAttribute('style')).toBe('max-width:100%');
  });

  it('preserves figure, picture and proxied image markup', () => {
    const src = '/img?url=' + encodeURIComponent('https://example.com/a.jpg');
    const html =
      '<figure><picture><source srcset="https://example.com/a.webp 1x, https://example.com/a@2x.webp 2x" type="image/webp" media="(min-width: 600px)">' +
      `<img src="${src}" srcset="https://example.com/a.jpg 1x" alt="A photo" width="800" height="600" data-original-src="https://example.com/a.jpg"></picture>` +
      '<figcaption><strong>Bold</strong> <em>em</em> <small>small</small> <b>b</b> <i>i</i></figcaption></figure>';
    expect(sanitiseArticleHtml(html)).toBe(html);
  });

  it('preserves headings, lists, quotes, code and tables', () => {
    const html =
      '<h2>H</h2><ul><li>a</li></ul><ol start="3"><li>b</li></ol><blockquote cite="https://a.test/">q</blockquote>' +
      '<pre><code>x &lt; y</code></pre><table><thead><tr><th scope="col">h</th></tr></thead><tbody><tr><td colspan="2">d</td></tr></tbody></table>';
    expect(sanitiseArticleHtml(html)).toBe(html);
  });

  it('keeps links and forces new-tab targets to be opener-safe', () => {
    const body = parse('<a href="https://a.test/" target="_top" rel="opener">x</a><a href="/img?url=y">y</a>');
    const [first, second] = Array.from(body.querySelectorAll('a'));
    expect(first.getAttribute('href')).toBe('https://a.test/');
    expect(first.getAttribute('target')).toBe('_blank');
    expect(first.getAttribute('rel')).toBe('noopener noreferrer');
    expect(second.getAttribute('href')).toBe('/img?url=y');
  });

  it('keeps fitted embeds with their inline style', () => {
    const fitted = fitMediaElements(
      '<iframe src="https://www.youtube.com/embed/x" width="560" height="315" allowfullscreen=""></iframe>' +
        '<video src="https://a.test/v.mp4" controls=""></video><embed src="https://a.test/e" type="video/mp4">',
    );
    expect(sanitiseArticleHtml(fitted)).toBe(fitted);
  });

  it('removes frames that are not absolute http(s) URLs and strips srcdoc', () => {
    const body = parse(
      '<iframe src="/article?url=x"></iframe><iframe src="javascript:alert(1)"></iframe><embed src="data:text/html,x">' +
        '<iframe src="https://a.test/" srcdoc="<script>alert(1)</script>"></iframe>',
    );
    const frames = Array.from(body.querySelectorAll('iframe, embed'));
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('src')).toBe('https://a.test/');
    expect(frames[0].hasAttribute('srcdoc')).toBe(false);
  });
});
