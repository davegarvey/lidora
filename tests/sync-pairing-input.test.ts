import { describe, expect, it } from 'vitest';
import { pairingErrorMessage, parsePairingInput } from '../src/sync/pairing';
import { SyncClientError } from '../src/sync/client';

describe('parsePairingInput', () => {
  it('accepts an 8-character code with or without the dash, in any case', () => {
    expect(parsePairingInput('abcd-efgh')).toEqual({ kind: 'code', code: 'abcdefgh' });
    expect(parsePairingInput(' ABCDEFGH ')).toEqual({ kind: 'code', code: 'abcdefgh' });
    expect(parsePairingInput('AbCd-EfGh')).toEqual({ kind: 'code', code: 'abcdefgh' });
  });

  it('accepts a 22-character key without changing its case', () => {
    expect(parsePairingInput('AbCdEfGhIjKlMnOpQrStUv')).toEqual({ kind: 'key', key: 'AbCdEfGhIjKlMnOpQrStUv' });
  });

  it('treats blank input as empty and anything else as invalid', () => {
    expect(parsePairingInput('   ')).toEqual({ kind: 'empty' });
    expect(parsePairingInput('abc').kind).toBe('invalid');
    expect(parsePairingInput('AbCdEfGhIjKlMnOpQrStU!').kind).toBe('invalid');
  });
});

describe('pairingErrorMessage', () => {
  it('maps redeem failures to short messages', () => {
    expect(pairingErrorMessage(new SyncClientError('Code not found', 404))).toBe('Code not found or expired');
    expect(pairingErrorMessage(new SyncClientError('x', 429))).toContain('Too many attempts');
    expect(pairingErrorMessage(new Error('Pull failed: 500'))).toBe('Pull failed: 500');
    expect(pairingErrorMessage('nope')).toBe('Pairing failed');
  });
});
