import { SyncClientError } from './client';
import { isValidSyncKey } from './key';

export type PairingInput =
  | { kind: 'empty' }
  | { kind: 'code'; code: string }
  | { kind: 'key'; key: string }
  | { kind: 'invalid'; message: string };

export function parsePairingInput(raw: string): PairingInput {
  const value = raw.trim();
  if (!value) return { kind: 'empty' };
  let candidate = value;
  if (value.length === 9 && value[4] === '-') candidate = value.slice(0, 4) + value.slice(5);
  if (candidate.length === 8) return { kind: 'code', code: candidate.toLowerCase() };
  if (isValidSyncKey(value)) return { kind: 'key', key: value };
  return { kind: 'invalid', message: 'Enter an 8-character code or a 22-character sync key' };
}

export function pairingErrorMessage(error: unknown): string {
  if (error instanceof SyncClientError) {
    if (error.status === 404) return 'Code not found or expired';
    if (error.status === 429) return 'Too many attempts. Try again in a few minutes.';
  }
  return error instanceof Error && error.message ? error.message : 'Pairing failed';
}
