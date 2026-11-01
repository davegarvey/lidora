import { describe, expect, it } from 'vitest';
import type { Item } from '../db/types';
import { rankForYou, smoothFeedReadRates } from './feedRanking';

function item(id: string, feedId: string, publishedAt: number): Item {
  return { id, feedId, guid: id, title: id, excerpt: '', publishedAt, updatedAt: publishedAt, createdAt: publishedAt, read: false, starred: false };
}

describe('For you ranking', () => {
  it('smooths small feed samples toward the all-feed rate', () => {
    const rates = smoothFeedReadRates([
      { feedId: 'quiet', articles: 2, read: 2 },
      { feedId: 'busy', articles: 18, read: 0 },
    ]);
    expect(rates.baseline).toBe(0.1);
    expect(rates.byFeed.get('quiet')).toBeCloseTo(0.25);
    expect(rates.byFeed.get('busy')).toBeCloseTo(0.0357142857);
  });

  it('falls back toward Latest when no read history exists', () => {
    const rates = smoothFeedReadRates([]);
    const items = [item('old', 'quiet', 1), item('new', 'busy', 10)];
    expect(rates.baseline).toBeNull();
    expect(rankForYou(items, rates, {}, 10).map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('keeps each feed chronological while mixing feeds by preference and recency', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const items = [
      item('busy-new', 'busy', now - 1_000),
      item('quiet-new', 'quiet', now - 5_000),
      item('quiet-old', 'quiet', now - 10_000),
      item('busy-old', 'busy', now - 20_000),
    ];
    const rates = { baseline: 0.5, byFeed: new Map([['quiet', 0.9], ['busy', 0.1]]) };
    const ranked = rankForYou(items, rates, {}, now);
    expect(ranked.map((entry) => entry.id)).toEqual(['quiet-new', 'quiet-old', 'busy-new', 'busy-old']);
  });

  it('uses direct feed feedback as a bounded ranking signal', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const items = [item('a', 'a', now), item('b', 'b', now)];
    const rates = { baseline: 0.5, byFeed: new Map([['a', 0.5], ['b', 0.5]]) };
    expect(rankForYou(items, rates, { b: 'more' }, now)[0].feedId).toBe('b');
    expect(rankForYou(items, rates, { b: 'less' }, now)[0].feedId).toBe('a');
  });
});
