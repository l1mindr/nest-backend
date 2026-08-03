import { readBodyString } from '../read-body-string.util';

const OPTIONS = { maxLength: 320 };

describe('readBodyString', () => {
  it('should read a plain string field', () => {
    expect(readBodyString({ email: 'user@test.com' }, 'email', OPTIONS)).toBe(
      'user@test.com'
    );
  });

  it('should trim surrounding whitespace', () => {
    expect(
      readBodyString({ email: '  user@test.com  ' }, 'email', OPTIONS)
    ).toBe('user@test.com');
  });

  it('should lowercase when asked', () => {
    expect(
      readBodyString({ email: 'User@Test.COM' }, 'email', {
        ...OPTIONS,
        lowercase: true
      })
    ).toBe('user@test.com');
  });

  it('should preserve case by default', () => {
    expect(readBodyString({ code: 'AbC123' }, 'code', OPTIONS)).toBe('AbC123');
  });

  it('should truncate to the maximum length', () => {
    const value = readBodyString({ email: 'a'.repeat(500) }, 'email', {
      maxLength: 320
    });

    expect(value).toHaveLength(320);
  });

  describe('hostile and absent input', () => {
    // Guards run before the validation pipe, so the body arrives exactly as the
    // client sent it. Each of these must yield null — "skip", not "deny".
    it.each([
      ['a missing field', { username: 'someone' }],
      ['an undefined value', { email: undefined }],
      ['a null value', { email: null }],
      ['an empty string', { email: '' }],
      ['a whitespace-only string', { email: '   ' }],
      ['a number', { email: 12345 }],
      ['a boolean', { email: true }],
      ['an array', { email: ['user@test.com'] }],
      ['a nested operator object', { email: { $ne: null } }]
    ])('should return null for %s', (_case, body) => {
      expect(readBodyString(body, 'email', OPTIONS)).toBeNull();
    });

    it.each([
      ['an undefined body', undefined],
      ['a null body', null],
      ['a string body', 'user@test.com'],
      ['an array body', [{ email: 'user@test.com' }]],
      ['a number body', 42]
    ])('should return null for %s', (_case, body) => {
      expect(readBodyString(body, 'email', OPTIONS)).toBeNull();
    });
  });
});
