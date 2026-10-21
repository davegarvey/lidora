// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { prepareArticleMedia } from '../src/articles/media';

function proxiedUrl(src: string | null): string | null {
  if (!src) return null;
  const url = new URL(src, window.location.origin);
  return url.pathname === '/img' ? url.searchParams.get('url') : null;
}

describe('prepareArticleMedia', () => {
  it('resolves root-relative feed images against the retained content base', () => {
    const html = prepareArticleMedia('<img src="/assets/chart.svg">', 'https://example.com/posts/one/');
    const image = new DOMParser().parseFromString(html, 'text/html').querySelector('img');

    expect(proxiedUrl(image?.getAttribute('src') ?? null)).toBe('https://example.com/assets/chart.svg');
  });

  it('rewrites responsive candidates in img and picture source srcsets with descriptors', () => {
    const html = prepareArticleMedia(
      '<picture><source srcset="small.svg 1x, /large.svg 2x"><img src="/fallback.svg" srcset="small.png 400w, large.png 800w"></picture>',
      'https://example.com/posts/one/',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sourceCandidates = doc.querySelector('source')!.getAttribute('srcset')!.split(', ');
    const imageCandidates = doc.querySelector('img')!.getAttribute('srcset')!.split(', ');

    expect(sourceCandidates.map((value) => `${proxiedUrl(value.split(' ')[0])} ${value.split(' ')[1]}`)).toEqual([
      'https://example.com/posts/one/small.svg 1x',
      'https://example.com/large.svg 2x',
    ]);
    expect(imageCandidates.map((value) => `${proxiedUrl(value.split(' ')[0])} ${value.split(' ')[1]}`)).toEqual([
      'https://example.com/posts/one/small.png 400w',
      'https://example.com/posts/one/large.png 800w',
    ]);
  });

  it('preserves an existing image proxy URL and removes invalid schemes', () => {
    const html = prepareArticleMedia(
      '<img src="/img?url=https%3A%2F%2Fexample.com%2Fa.svg" srcset="data:image/png;base64,AAAA 1x, https://example.com/b.svg 2x">',
      'https://example.com/post',
    );
    const image = new DOMParser().parseFromString(html, 'text/html').querySelector('img')!;

    expect(image.getAttribute('src')).toBe('/img?url=https%3A%2F%2Fexample.com%2Fa.svg');
    expect(image.getAttribute('srcset')).toContain('/img?url=https%3A%2F%2Fexample.com%2Fb.svg 2x');
    expect(image.getAttribute('srcset')).not.toContain('data:');
  });
});
