import { describe, it, expect } from 'vitest';
import { tokenFingerprint, sha256Hex } from '../server/sync/tokens';
import { fingerprintSyncKey } from '../src/sync/key';

describe('fingerprints and hashes', () => {
  it('agent fingerprints match the browser scheme (fixed vector)', async () => {
    const grantId = 't0123456789abcdefghijklmn';
    const server = await tokenFingerprint(grantId);
    expect(server).toBe(await fingerprintSyncKey(grantId));
    expect(server).toMatch(/^[0-9A-Z]{4}$/);
  });

  it('sha256Hex produces a stable hex digest', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
