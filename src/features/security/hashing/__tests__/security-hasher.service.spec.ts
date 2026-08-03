import { ConfigType } from '@nestjs/config';
import securityConfig from '@infrastructure/config/security/security.config';
import { createHmac } from 'crypto';
import {
  DEFAULT_HASH_LENGTH,
  SecurityHasher
} from '../security-hasher.service';

const SECRET = 'test-security-hash-secret';

describe('SecurityHasher', () => {
  let hasher: SecurityHasher;

  beforeEach(() => {
    hasher = new SecurityHasher({ hashSecret: SECRET } as ConfigType<
      typeof securityConfig
    >);
  });

  it('should produce a hex digest of the default length', () => {
    const digest = hasher.hmacHex('user@test.com');

    expect(digest).toHaveLength(DEFAULT_HASH_LENGTH);
    expect(digest).toMatch(/^[0-9a-f]+$/);
  });

  it('should honour an explicit length', () => {
    expect(hasher.hmacHex('user@test.com', 12)).toHaveLength(12);
  });

  it('should be deterministic for the same input', () => {
    expect(hasher.hmacHex('user@test.com')).toBe(
      hasher.hmacHex('user@test.com')
    );
  });

  it('should produce different digests for different inputs', () => {
    expect(hasher.hmacHex('a@test.com')).not.toBe(hasher.hmacHex('b@test.com'));
  });

  it('should key the digest with the configured secret', () => {
    const other = new SecurityHasher({
      hashSecret: 'a-different-secret'
    } as ConfigType<typeof securityConfig>);

    expect(hasher.hmacHex('user@test.com')).not.toBe(
      other.hmacHex('user@test.com')
    );
  });

  it('should match a plain HMAC-SHA256 truncated to the requested length', () => {
    const expected = createHmac('sha256', SECRET)
      .update('user@test.com')
      .digest('hex')
      .slice(0, DEFAULT_HASH_LENGTH);

    expect(hasher.hmacHex('user@test.com')).toBe(expected);
  });

  it('should not leak the raw value into the digest', () => {
    expect(hasher.hmacHex('attacker@example.com')).not.toContain('attacker');
  });
});
