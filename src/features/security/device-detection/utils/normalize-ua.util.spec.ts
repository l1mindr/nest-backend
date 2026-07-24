import { normalizeUA } from './normalize-ua.util';

describe('normalizeUA', () => {
  it('should return empty string for undefined input', () => {
    expect(normalizeUA(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(normalizeUA('')).toBe('');
  });

  it('should collapse multiple spaces into one', () => {
    expect(normalizeUA('Mozilla  Firefox   Chrome')).toBe(
      'Mozilla Firefox Chrome'
    );
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeUA('  Mozilla/5.0  ')).toBe('Mozilla/5.0');
  });

  it('should truncate to 500 characters', () => {
    const longUA = 'A'.repeat(600);
    expect(normalizeUA(longUA)).toHaveLength(500);
  });

  it('should not truncate strings under 500 characters', () => {
    const shortUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    expect(normalizeUA(shortUA)).toBe(shortUA);
  });

  it('should handle strings with only whitespace', () => {
    expect(normalizeUA('   ')).toBe('');
  });
});
