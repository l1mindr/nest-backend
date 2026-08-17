import { sanitizeMetadata } from '../metadata-sanitizer';

describe('sanitizeMetadata', () => {
  it('should return undefined for empty metadata', () => {
    expect(sanitizeMetadata(undefined)).toBeUndefined();
    expect(sanitizeMetadata({})).toBeUndefined();
  });

  it('should redact sensitive keys - passwords', () => {
    const input = {
      username: 'john',
      password: 'secret123',
      passwordHash: '$2b$10$abcdef',
      data: { hash: 'somehash' }
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      username: 'john',
      password: '[REDACTED]',
      passwordHash: '[REDACTED]',
      data: { hash: '[REDACTED]' }
    });
  });

  it('should redact sensitive keys - tokens', () => {
    const input = {
      userId: '123',
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      refreshToken: 'refresh-token-here',
      jwt: 'jwt-token',
      bearer: 'Bearer token'
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      userId: '123',
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      jwt: '[REDACTED]',
      bearer: '[REDACTED]'
    });
  });

  it('should redact sensitive keys - codes and secrets', () => {
    const input = {
      email: 'test@example.com',
      verificationCode: '123456',
      otp: '654321',
      code: 'ABC123',
      apiKey: 'sk_test_123',
      secret: 'my-secret',
      csrfToken: 'csrf-value'
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      email: 'test@example.com',
      verificationCode: '[REDACTED]',
      otp: '[REDACTED]',
      code: '[REDACTED]',
      apiKey: '[REDACTED]',
      secret: '[REDACTED]',
      csrfToken: '[REDACTED]'
    });
  });

  it('should redact sensitive keys - headers', () => {
    const input = {
      method: 'POST',
      authorization: 'Bearer token',
      cookie: 'session=abc123',
      privateKey: '-----BEGIN PRIVATE KEY-----'
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      method: 'POST',
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      privateKey: '[REDACTED]'
    });
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        id: '123',
        email: 'test@example.com',
        password: 'secret'
      },
      session: {
        token: 'session-token',
        expiresAt: '2024-01-01'
      }
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      user: {
        id: '123',
        email: 'test@example.com',
        password: '[REDACTED]'
      },
      session: {
        token: '[REDACTED]',
        expiresAt: '2024-01-01'
      }
    });
  });

  it('should handle arrays', () => {
    const input = {
      users: [
        { id: '1', password: 'secret1' },
        { id: '2', password: 'secret2' }
      ],
      // 'tokens' contains the sensitive substring 'token' → entire value redacted
      tokens: ['token1', 'token2']
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      users: [
        { id: '1', password: '[REDACTED]' },
        { id: '2', password: '[REDACTED]' }
      ],
      tokens: '[REDACTED]'
    });
  });

  it('should preserve non-sensitive data', () => {
    const input = {
      userId: '123',
      action: 'LOGIN',
      timestamp: '2024-01-01T00:00:00Z',
      metadata: {
        browser: 'Chrome',
        os: 'Linux'
      }
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual(input);
  });

  it('should handle null and undefined values', () => {
    const input = {
      userId: '123',
      password: null,
      token: undefined,
      name: 'John'
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      userId: '123',
      password: null,
      token: undefined,
      name: 'John'
    });
  });

  it('should be case-insensitive for sensitive keys', () => {
    const input = {
      Password: 'secret',
      AccessToken: 'token',
      API_KEY: 'key',
      RefreshToken: 'refresh'
    };

    const result = sanitizeMetadata(input);

    expect(result).toEqual({
      Password: '[REDACTED]',
      AccessToken: '[REDACTED]',
      API_KEY: '[REDACTED]',
      RefreshToken: '[REDACTED]'
    });
  });
});
