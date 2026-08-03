import { SecurityHasher } from '../../../hashing/security-hasher.service';
import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { RateLimitRule } from '../../types/rate-limit-rule.interface';
import { RateLimitKeyBuilder } from '../rate-limit-key.builder';

const rule = (overrides: Partial<RateLimitRule> = {}): RateLimitRule => ({
  name: 'auth.login.ip',
  identifier: RateLimitIdentifier.IP,
  keyPrefix: 'login',
  limit: 5,
  windowMs: 60_000,
  blockDurationMs: 0,
  enabled: true,
  failOpen: true,
  ...overrides
});

describe('RateLimitKeyBuilder', () => {
  let builder: RateLimitKeyBuilder;

  beforeEach(() => {
    // A real hasher, so the determinism and non-disclosure assertions below are
    // not satisfied vacuously by a constant stub.
    builder = new RateLimitKeyBuilder(
      new SecurityHasher({ hashSecret: 'test-security-hash-secret' } as any)
    );
  });

  describe('counterKey', () => {
    it('should follow the rl:{prefix}:{identifier}:{hash} shape', () => {
      expect(builder.counterKey(rule(), '203.0.113.10')).toMatch(
        /^rl:login:ip:[0-9a-f]{32}$/
      );
    });

    it('should namespace by identifier type', () => {
      expect(
        builder.counterKey(
          rule({
            identifier: RateLimitIdentifier.VERIFICATION_CODE,
            keyPrefix: 'verify'
          }),
          '123456'
        )
      ).toMatch(/^rl:verify:code:[0-9a-f]{32}$/);
    });

    it('should be deterministic', () => {
      expect(builder.counterKey(rule(), '203.0.113.10')).toBe(
        builder.counterKey(rule(), '203.0.113.10')
      );
    });

    it('should separate different identifier values', () => {
      expect(builder.counterKey(rule(), '203.0.113.10')).not.toBe(
        builder.counterKey(rule(), '203.0.113.11')
      );
    });

    it('should separate the same value arriving through different dimensions', () => {
      const asEmail = builder.counterKey(
        rule({ identifier: RateLimitIdentifier.EMAIL }),
        'shared-value'
      );
      const asUsername = builder.counterKey(
        rule({ identifier: RateLimitIdentifier.USERNAME }),
        'shared-value'
      );

      expect(asEmail).not.toBe(asUsername);
    });
  });

  describe('blockKey', () => {
    it('should suffix the counter key', () => {
      const value = '203.0.113.10';

      expect(builder.blockKey(rule(), value)).toBe(
        `${builder.counterKey(rule(), value)}:blocked`
      );
    });
  });

  describe('non-disclosure', () => {
    it('should not embed a raw email address in the key', () => {
      const key = builder.counterKey(
        rule({ identifier: RateLimitIdentifier.EMAIL, keyPrefix: 'login' }),
        'attacker@example.com'
      );

      expect(key).not.toContain('attacker');
      expect(key).not.toContain('example.com');
    });

    it('should not embed a raw verification code in the key', () => {
      const key = builder.counterKey(
        rule({
          identifier: RateLimitIdentifier.VERIFICATION_CODE,
          keyPrefix: 'verify'
        }),
        '123456'
      );

      expect(key).not.toContain('123456');
    });
  });

  describe('fingerprint', () => {
    it('should be a short prefix of the key hash', () => {
      const value = 'attacker@example.com';
      const emailRule = rule({ identifier: RateLimitIdentifier.EMAIL });

      const fingerprint = builder.fingerprint(emailRule, value);

      expect(fingerprint).toHaveLength(12);
      expect(builder.counterKey(emailRule, value)).toContain(fingerprint);
    });

    it('should not disclose the raw value', () => {
      expect(
        builder.fingerprint(
          rule({ identifier: RateLimitIdentifier.EMAIL }),
          'attacker@example.com'
        )
      ).not.toContain('attacker');
    });
  });
});
