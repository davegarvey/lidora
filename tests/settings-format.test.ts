import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, storageSummary } from '../src/settings/format';

describe('settings formatting', () => {
  it('formats sizes in KB, MB and GB', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(73_728)).toBe('72 KB');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024 KB');
    expect(formatBytes(5 * 1024 * 1024 + 512 * 1024)).toBe('5.5 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('reports missing sizes as unavailable', () => {
    expect(formatBytes(null)).toBe('Unavailable');
    expect(formatBytes(Number.NaN)).toBe('Unavailable');
  });

  it('groups thousands in counts', () => {
    expect(formatCount(1204)).toBe('1,204');
  });

  it('summarises usage and articles on one line', () => {
    expect(storageSummary(73_728, 1204)).toBe('72 KB used · 1,204 articles');
    expect(storageSummary(73_728, 1)).toBe('72 KB used · 1 article');
    expect(storageSummary(null, 3)).toBe('3 articles');
  });
});
