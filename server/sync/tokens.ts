/**
 * Hashing and display-fingerprint primitives shared by sync and agent access.
 */

/** Crockford base32 alphabet (0-9 and A-Z minus I, L, O, U). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Crockford fingerprint of an arbitrary string: SHA-256, first 20 bits
 * rendered as 4 uppercase Crockford characters — byte-identical to the
 * browser's `fingerprintSyncKey` scheme.
 */
async function crockfordFingerprint(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const value = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) & 0xFFFFF;
  return (
    CROCKFORD[(value >> 15) & 31] +
    CROCKFORD[(value >> 10) & 31] +
    CROCKFORD[(value >> 5) & 31] +
    CROCKFORD[value & 31]
  );
}

/** Display fingerprint for an agent grant identifier — shown in Agent access. */
export async function tokenFingerprint(token: string): Promise<string> {
  return crockfordFingerprint(token);
}
