import { describe, it, expect } from 'vitest';
import { riverListState, sameRiverListState, type RiverListInput } from './river-state';
import type { Feed } from '../db/types';

function feed(id: string, overrides: Partial<Feed> = {}): Feed {
  return { id, url: `https://${id}.example/feed.xml`, title: id, learnedIntervalMs: 3_600_000, lastFetched: null, ...overrides };
}

function input(overrides: Partial<RiverListInput> = {}): RiverListInput {
  const feeds = overrides.feeds ?? [feed('a')];
  return {
    itemCount: 0,
    hydrated: true,
    feeds,
    scope: new Set(feeds.map((f) => f.id)),
    fetching: new Set(),
    feedErrors: {},
    ...overrides,
  };
}

describe('riverListState', () => {
  it('shows items when there are any', () => {
    expect(riverListState(input({ itemCount: 2 }))).toEqual({ kind: 'items' });
  });

  it('loads until hydrated', () => {
    expect(riverListState(input({ hydrated: false }))).toEqual({ kind: 'loading' });
  });

  it('is empty without feeds', () => {
    expect(riverListState(input({ feeds: [] }))).toEqual({ kind: 'empty' });
  });

  it('names a single unfetched feed', () => {
    expect(riverListState(input())).toEqual({ kind: 'fetching-new', message: 'Fetching a…' });
  });

  it('describes several unfetched feeds together', () => {
    expect(riverListState(input({ feeds: [feed('a'), feed('b')] }))).toEqual({
      kind: 'fetching-new',
      message: 'Fetching your new feeds…',
    });
  });

  it('shows the empty state for a fetched feed without items', () => {
    expect(riverListState(input({ feeds: [feed('a', { lastFetched: 1 })] }))).toEqual({ kind: 'empty' });
  });

  it('shows the empty state when only some selected feeds are unfetched', () => {
    expect(riverListState(input({ feeds: [feed('a'), feed('b', { lastFetched: 1 })] }))).toEqual({ kind: 'empty' });
  });

  it('ignores unfetched feeds outside the selection', () => {
    const feeds = [feed('a', { lastFetched: 1 }), feed('b')];
    expect(riverListState(input({ feeds, scope: new Set(['a']) }))).toEqual({ kind: 'empty' });
  });

  it('keeps loading while a fetched feed refreshes', () => {
    const feeds = [feed('a', { lastFetched: 1 })];
    expect(riverListState(input({ feeds, fetching: new Set(['a']) }))).toEqual({ kind: 'loading' });
  });

  it('reports a failed first fetch for a single feed', () => {
    expect(riverListState(input({ feedErrors: { a: 'HTTP 404' } }))).toEqual({
      kind: 'first-fetch-failed',
      feedId: 'a',
      feedTitle: 'a',
      error: 'HTTP 404',
    });
  });

  it('reads a persisted error when the in-memory one is gone', () => {
    const feeds = [feed('a', { lastError: 'HTTP 500', refreshError: { retryAt: 1, attempts: 1, lastStatus: 500, lastRetryAfter: null } })];
    expect(riverListState(input({ feeds }))).toMatchObject({ kind: 'first-fetch-failed', error: 'HTTP 500' });
  });

  it('does not claim fetching for several feeds when one has failed', () => {
    expect(riverListState(input({ feeds: [feed('a'), feed('b')], feedErrors: { a: 'HTTP 404' } }))).toEqual({ kind: 'empty' });
  });

  it('compares states structurally', () => {
    expect(sameRiverListState({ kind: 'empty' }, { kind: 'empty' })).toBe(true);
    expect(sameRiverListState({ kind: 'fetching-new', message: 'x' }, { kind: 'fetching-new', message: 'y' })).toBe(false);
  });
});
