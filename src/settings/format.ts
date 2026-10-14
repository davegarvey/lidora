const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

const numberFormat = new Intl.NumberFormat('en-GB');

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function storageSummary(usage: number | null, articles: number): string {
  const count = `${formatCount(articles)} ${articles === 1 ? 'article' : 'articles'}`;
  return usage === null ? count : `${formatBytes(usage)} used · ${count}`;
}
