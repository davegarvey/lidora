import type { Item } from '../db/types';

export type FeedRankingFeedback = 'more' | 'less';

export interface FeedReadSample {
  feedId: string;
  articles: number;
  read: number;
}

export interface FeedReadRates {
  baseline: number | null;
  byFeed: Map<string, number>;
}

const PRIOR_ARTICLES = 10;
const RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
const FEEDBACK_ADJUSTMENT = 0.18;
const DIVERSITY_PENALTY = 0.12;

export function smoothFeedReadRates(samples: readonly FeedReadSample[]): FeedReadRates {
  const articles = samples.reduce((sum, sample) => sum + sample.articles, 0);
  const read = samples.reduce((sum, sample) => sum + sample.read, 0);
  const baseline = articles > 0 ? read / articles : null;
  const byFeed = new Map<string, number>();
  for (const sample of samples) {
    if (baseline == null) continue;
    byFeed.set(sample.feedId, (sample.read + PRIOR_ARTICLES * baseline) / (sample.articles + PRIOR_ARTICLES));
  }
  return { baseline, byFeed };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rankForYou(
  items: readonly Item[],
  rates: FeedReadRates,
  feedback: Readonly<Record<string, FeedRankingFeedback>>,
  now = Date.now(),
): Item[] {
  const queues = new Map<string, Item[]>();
  for (const item of items) {
    const queue = queues.get(item.feedId) ?? [];
    queue.push(item);
    queues.set(item.feedId, queue);
  }
  for (const queue of queues.values()) {
    queue.sort((a, b) => b.publishedAt - a.publishedAt || a.id.localeCompare(b.id));
  }

  const positions = new Map<string, number>();
  const emitted = new Map<string, number>();
  const result: Item[] = [];
  const baseline = rates.baseline ?? 0.5;

  while (result.length < items.length) {
    let chosenFeed: string | undefined;
    let chosenItem: Item | undefined;
    let chosenScore = -Infinity;

    for (const [feedId, queue] of queues) {
      const position = positions.get(feedId) ?? 0;
      const item = queue[position];
      if (!item) continue;
      const rate = rates.byFeed.get(feedId) ?? baseline;
      const adjustment = feedback[feedId] === 'more' ? FEEDBACK_ADJUSTMENT : feedback[feedId] === 'less' ? -FEEDBACK_ADJUSTMENT : 0;
      const affinity = clamp(rate + adjustment, 0, 1);
      const age = Math.max(0, now - item.publishedAt);
      const freshness = 1 / (1 + age / RECENCY_HALF_LIFE_MS);
      const score = freshness * 0.55 + affinity * 0.45 - (emitted.get(feedId) ?? 0) * DIVERSITY_PENALTY;
      if (score > chosenScore || (score === chosenScore && item.publishedAt > (chosenItem?.publishedAt ?? -Infinity))) {
        chosenFeed = feedId;
        chosenItem = item;
        chosenScore = score;
      }
    }

    if (!chosenFeed || !chosenItem) break;
    result.push(chosenItem);
    positions.set(chosenFeed, (positions.get(chosenFeed) ?? 0) + 1);
    emitted.set(chosenFeed, (emitted.get(chosenFeed) ?? 0) + 1);
  }

  return result;
}
