import type { Item } from './db/types';

export function pendingPresentation(current: readonly Item[], candidate: readonly Item[]): string | null {
  const currentIds = current.map((item) => item.id);
  const nextIds = candidate.map((item) => item.id);
  const currentSet = new Set(currentIds);
  const nextSet = new Set(nextIds);
  const additions = new Set(candidate.filter((item) => !currentSet.has(item.id)).map((item) => item.id)).size;
  const oldSurvivors = currentIds.filter((id) => nextSet.has(id)).join('\0');
  const nextSurvivors = nextIds.filter((id) => currentSet.has(id)).join('\0');
  const onlyAdditions = oldSurvivors === nextSurvivors && currentIds.every((id) => nextSet.has(id));
  if (additions > 0 && onlyAdditions) return `Show ${additions} new`;
  return nextIds.join('\0') === currentIds.join('\0') ? null : 'Show updates';
}

export function mergePresentedRecords(presented: readonly Item[], candidate: readonly Item[]): Item[] {
  const candidateById = new Map(candidate.map((item) => [item.id, item]));
  return presented.map((item) => candidateById.get(item.id) ?? item);
}
