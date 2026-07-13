import { createHash } from 'crypto';
import { RefreshTokenHasher } from './refresh-token-hasher.provider';

describe('RefreshTokenHasher', () => {
  let hasher: RefreshTokenHasher;

  const token = `header.${'a'.repeat(400)}.signature`;

  beforeEach(() => {
    hasher = new RefreshTokenHasher();
  });

  describe('hash', () => {
    it('should produce the SHA-256 hex digest of the entire token', () => {
      const expected = createHash('sha256').update(token).digest('hex');

      expect(hasher.hash(token)).toBe(expected);
    });

    it('should produce a 64-character (32-byte) hex digest', () => {
      expect(hasher.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should differ when a byte past the 72-byte mark changes', () => {
      const altered = `${token}x`;

      expect(hasher.hash(token)).not.toBe(hasher.hash(altered));
    });
  });

  describe('compare', () => {
    it('should validate a token against its own stored digest', () => {
      const stored = hasher.hash(token);

      expect(hasher.compare(token, stored)).toBe(true);
    });

    it('should reject an altered token', () => {
      const stored = hasher.hash(token);

      expect(hasher.compare(`${token}-tampered`, stored)).toBe(false);
    });

    it('should reject a rotated token against the previous stored digest', () => {
      const previous = hasher.hash(token);
      const rotated = `${token}.rotated`;

      expect(hasher.compare(rotated, previous)).toBe(false);
    });

    it('should return false (not throw) when the stored hash length differs', () => {
      expect(hasher.compare(token, 'deadbeef')).toBe(false);
    });

    it('should return false (not throw) for a non-hex stored value', () => {
      expect(hasher.compare(token, 'not-a-hex-hash')).toBe(false);
    });
  });
});
