interface SourceCandidate {
  url: string;
  descriptor: string;
}

function parseSrcset(input: string): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  let position = 0;

  while (position < input.length) {
    while (position < input.length && /[\s,]/.test(input[position])) position++;
    if (position >= input.length) break;

    const start = position;
    while (position < input.length && !/\s/.test(input[position])) position++;
    let url = input.slice(start, position);
    const trailingCommas = url.match(/,+$/)?.[0].length ?? 0;
    if (trailingCommas > 0) {
      url = url.slice(0, -trailingCommas);
      if (url) candidates.push({ url, descriptor: '' });
      continue;
    }

    while (position < input.length && /\s/.test(input[position])) position++;
    const descriptorStart = position;
    while (position < input.length && input[position] !== ',') position++;
    const descriptor = input.slice(descriptorStart, position).trim().replace(/\s+/g, ' ');
    if (url) candidates.push({ url, descriptor });
    if (input[position] === ',') position++;
  }

  return candidates;
}

function imageUrl(source: string, baseUrl: string | undefined): string | undefined {
  if (source.startsWith('/img?url=')) return source;
  try {
    const url = new URL(source, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (typeof window !== 'undefined' && url.origin === window.location.origin) {
      if (url.pathname === '/img' && url.searchParams.has('url')) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      return url.href;
    }
    return `/img?url=${encodeURIComponent(url.href)}`;
  } catch {
    return undefined;
  }
}

function rewriteSrcset(value: string, baseUrl: string | undefined): string {
  return parseSrcset(value)
    .flatMap(({ url, descriptor }) => {
      const proxied = imageUrl(url, baseUrl);
      return proxied ? [`${proxied}${descriptor ? ` ${descriptor}` : ''}`] : [];
    })
    .join(', ');
}

export function prepareArticleMedia(html: string, baseUrl?: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.getAttribute('src');
    if (src) {
      const resolved = imageUrl(src, baseUrl);
      if (resolved) img.setAttribute('src', resolved);
      else img.removeAttribute('src');
    }
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const rewritten = rewriteSrcset(srcset, baseUrl);
      if (rewritten) img.setAttribute('srcset', rewritten);
      else img.removeAttribute('srcset');
    }
  }
  for (const source of Array.from(doc.querySelectorAll('picture source[srcset]'))) {
    const srcset = source.getAttribute('srcset');
    if (!srcset) continue;
    const rewritten = rewriteSrcset(srcset, baseUrl);
    if (rewritten) source.setAttribute('srcset', rewritten);
    else source.removeAttribute('srcset');
  }
  return doc.body.innerHTML;
}
