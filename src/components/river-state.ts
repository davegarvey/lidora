import type { Feed } from '../db/types';

export type RiverListState =
  | { kind: 'items' }
  | { kind: 'loading' }
  | { kind: 'fetching-new'; message: string }
  | { kind: 'first-fetch-failed'; feedId: string; feedTitle: string; error: string }
  | { kind: 'empty' };

export interface RiverListInput {
  itemCount: number;
  hydrated: boolean;
  feeds: readonly Feed[];
  scope: ReadonlySet<string>;
  fetching: ReadonlySet<string>;
  feedErrors: Readonly<Record<string, string>>;
}

function feedError(feed: Feed, feedErrors: Readonly<Record<string, string>>): string | undefined {
  return feedErrors[feed.id] ?? (feed.refreshError ? feed.lastError ?? undefined : undefined);
}

export function riverListState(input: RiverListInput): RiverListState {
  if (input.itemCount > 0) return { kind: 'items' };
  if (!input.hydrated) return { kind: 'loading' };
  if (input.feeds.length === 0) return { kind: 'empty' };
  const scoped = input.feeds.filter((feed) => input.scope.has(feed.id) && Boolean(feed.url));
  const unfetched = scoped.filter((feed) => feed.lastFetched == null);
  if (scoped.length > 0 && unfetched.length === scoped.length) {
    if (scoped.length === 1) {
      const error = feedError(scoped[0], input.feedErrors);
      if (error) return { kind: 'first-fetch-failed', feedId: scoped[0].id, feedTitle: scoped[0].title, error };
    }
    if (scoped.every((feed) => !feedError(feed, input.feedErrors))) {
      return {
        kind: 'fetching-new',
        message: scoped.length === 1 ? `Fetching ${scoped[0].title}…` : 'Fetching your new feeds…',
      };
    }
  }
  return [...input.scope].some((id) => input.fetching.has(id)) ? { kind: 'loading' } : { kind: 'empty' };
}

export function sameRiverListState(a: RiverListState, b: RiverListState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'fetching-new' && b.kind === 'fetching-new') return a.message === b.message;
  if (a.kind === 'first-fetch-failed' && b.kind === 'first-fetch-failed') {
    return a.feedId === b.feedId && a.feedTitle === b.feedTitle && a.error === b.error;
  }
  return true;
}
