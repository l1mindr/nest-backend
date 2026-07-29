import {
  decodeCursor,
  encodeCursor,
  isValidUUID,
  UUID_RE
} from '../cursor.util';

describe('cursor.util', () => {
  describe('UUID_RE', () => {
    it('should match valid UUIDs', () => {
      expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should reject non-UUID strings', () => {
      expect(UUID_RE.test('not-a-uuid')).toBe(false);
      expect(UUID_RE.test('')).toBe(false);
      expect(UUID_RE.test('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('encodeCursor', () => {
    it('should encode a string to base64url', () => {
      const value = '550e8400-e29b-41d4-a716-446655440000';
      const encoded = encodeCursor(value);
      expect(encoded).toBe(Buffer.from(value, 'utf-8').toString('base64url'));
    });

    it('should encode arbitrary strings', () => {
      const encoded = encodeCursor('hello world');
      expect(encoded).toBe(
        Buffer.from('hello world', 'utf-8').toString('base64url')
      );
    });
  });

  describe('decodeCursor', () => {
    it('should decode a base64url cursor back to original', () => {
      const original = '550e8400-e29b-41d4-a716-446655440000';
      const encoded = encodeCursor(original);
      expect(decodeCursor(encoded)).toBe(original);
    });

    it('should round-trip arbitrary strings', () => {
      const original = 'hello world';
      expect(decodeCursor(encodeCursor(original))).toBe(original);
    });

    it('should produce a decoded string from non-canonical base64url input', () => {
      const result = decodeCursor('!!!invalid!!!');
      expect(typeof result).toBe('string');
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return false for non-UUID strings', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });
});
