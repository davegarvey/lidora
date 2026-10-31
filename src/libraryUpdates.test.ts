import { describe, expect, it } from 'vitest';
import type { Item } from './db/types';
import { pendingPresentation } from './libraryUpdates';

const item = (id: string): Item => ({
  id,
  feedId: 'feed',
  guid: id,
  title: id,
  publishedAt: 1,
  updatedAt: 1,
  excerpt: '',
  read: false,
  starred: false,
  createdAt: 1,
});

describe('pendingPresentation', () => {
  it('counts distinct candidate additions and ignores repeated batches', () => {
    expect(pendingPresentation([item('a')], [item('b'), item('a'), item('b')])).toBe('Show 1 new');
  });

  it('describes removals and reordering as updates', () => {
    expect(pendingPresentation([item('a'), item('b')], [item('b')])).toBe('Show updates');
    expect(pendingPresentation([item('a'), item('b')], [item('b'), item('a')])).toBe('Show updates');
  });

  it('clears when the candidate matches the presented IDs', () => {
    expect(pendingPresentation([item('a')], [item('a')])).toBeNull();
  });
});
