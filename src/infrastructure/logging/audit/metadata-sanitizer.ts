/**
 * Sanitizes metadata to ensure no sensitive information is persisted.
 *
 * NEVER persist:
 * - passwords, password hashes
 * - access tokens, refresh tokens, JWTs
 * - OTP/verification codes
 * - API keys, secrets
 * - authorization headers, cookies
 * - private keys
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'hash',
  'accessToken',
  'refreshToken',
  'token',
  'jwt',
  'bearer',
  'otp',
  'verificationCode',
  'code',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'privateKey',
  'key',
  'csrf',
  'xsrf'
];

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      // Preserve null/undefined — there is no secret value to redact
      sanitized[key] = value;
    } else if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' ? sanitizeObject(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) {
    return undefined;
  }

  return sanitizeObject(metadata);
}
