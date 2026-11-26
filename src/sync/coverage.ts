export const COVERAGE_VALIDITY_MS = 45 * 60_000;

let coveredIds: ReadonlySet<string> = new Set();
let receivedAt = 0;

export function setServerCoverage(feedIds: Iterable<string>, at = Date.now()): void {
  coveredIds = new Set(feedIds);
  receivedAt = at;
}

export function clearServerCoverage(): void {
  coveredIds = new Set();
  receivedAt = 0;
}

export function isServerCovered(feedId: string, now = Date.now()): boolean {
  return now - receivedAt < COVERAGE_VALIDITY_MS && coveredIds.has(feedId);
}
