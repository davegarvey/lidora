import { describe, expect, it } from 'vitest';
import { fullTimestamp, humanRelativeTime } from './time';

const NOW = new Date(2026, 9, 31, 12, 0).getTime();
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000);

describe('humanRelativeTime', () => {
  it('names the weekday for dates under a week old', () => {
    expect(humanRelativeTime(daysAgo(1), NOW)).toBe('yesterday');
    expect(humanRelativeTime(new Date(2026, 9, 27, 12, 0), NOW)).toBe('Tuesday');
  });

  it('shows day and month for older dates in the current year', () => {
    expect(humanRelativeTime(new Date(2026, 9, 23, 17, 56), NOW)).toBe('23 Oct');
    expect(humanRelativeTime(new Date(2026, 7, 15), NOW)).toBe('15 Aug');
    expect(humanRelativeTime(new Date(2026, 0, 1), NOW)).toBe('1 Jan');
  });

  it('adds the year for dates in an earlier year', () => {
    expect(humanRelativeTime(new Date(2025, 11, 30), NOW)).toBe('30 Dec 2025');
  });

  it('never reports a recent date as last month', () => {
    for (let days = 7; days < 60; days++) {
      expect(humanRelativeTime(daysAgo(days), NOW)).not.toMatch(/month/);
    }
  });
});

describe('fullTimestamp', () => {
  it('includes the year and time', () => {
    const label = fullTimestamp(new Date(2026, 9, 23, 17, 56));
    expect(label).toContain('2026');
    expect(label).toMatch(/56/);
  });
});
