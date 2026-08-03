import { TimeConstants } from '@infrastructure/clock/time.constants';
import {
  ALWAYS_RESOLVABLE_IDENTIFIERS,
  RateLimitIdentifier
} from '../../types/rate-limit-identifier.enum';
import {
  RateLimitPolicyGroup,
  RateLimitRule
} from '../../types/rate-limit-rule.interface';
import {
  ImperativeRateLimitPolicies,
  RateLimitPolicies
} from '../rate-limit.config';

const guardGroups: [string, RateLimitPolicyGroup][] = Object.entries(
  RateLimitPolicies
).flatMap(([feature, routes]) =>
  Object.entries(routes).map(
    ([route, group]) =>
      [`${feature}.${route}`, group as RateLimitPolicyGroup] as [
        string,
        RateLimitPolicyGroup
      ]
  )
);

const guardRules: RateLimitRule[] = guardGroups.flatMap(([, group]) =>
  Object.values(group)
);

const imperativeRules: RateLimitRule[] = Object.values(
  ImperativeRateLimitPolicies
);

const allRules = [...guardRules, ...imperativeRules];

describe('Rate limit configuration', () => {
  it('should define at least one policy group', () => {
    expect(guardGroups.length).toBeGreaterThan(0);
  });

  describe('policy names', () => {
    it('should be unique across guard and imperative policies', () => {
      const names = allRules.map((rule) => rule.name);

      expect(new Set(names).size).toBe(names.length);
    });

    it.each(allRules.map((rule) => [rule.name, rule] as const))(
      '%s should be namespaced <feature>.<route>.<dimension>',
      (_name, rule) => {
        expect(rule.name).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+$/);
      }
    );
  });

  describe('rule values', () => {
    it.each(allRules.map((rule) => [rule.name, rule] as const))(
      '%s should carry sane numbers',
      (_name, rule) => {
        expect(rule.limit).toBeGreaterThan(0);
        expect(Number.isInteger(rule.limit)).toBe(true);
        expect(rule.windowMs).toBeGreaterThan(0);
        expect(rule.blockDurationMs).toBeGreaterThanOrEqual(0);
        expect(rule.keyPrefix.length).toBeGreaterThan(0);
        expect(typeof rule.enabled).toBe('boolean');
        expect(typeof rule.failOpen).toBe('boolean');
      }
    );

    it.each(allRules.map((rule) => [rule.name, rule] as const))(
      '%s should provide a key generator when it is a custom rule',
      (_name, rule) => {
        if (rule.identifier === RateLimitIdentifier.CUSTOM) {
          expect(typeof rule.keyGenerator).toBe('function');
        }
      }
    );
  });

  describe('coverage invariant', () => {
    // A body-derived dimension resolves to null when the field is missing, and
    // a null resolution skips the rule. Without a dimension that always
    // resolves, an empty body would leave a route entirely unlimited.
    it.each(guardGroups.map(([name, group]) => [name, group] as const))(
      '%s should include a dimension that always resolves',
      (_name, group) => {
        const identifiers = Object.values(group).map((rule) => rule.identifier);

        expect(
          identifiers.some((identifier) =>
            ALWAYS_RESOLVABLE_IDENTIFIERS.includes(identifier)
          )
        ).toBe(true);
      }
    );
  });

  describe('required dimensions per endpoint', () => {
    const dimensionsOf = (group: RateLimitPolicyGroup) =>
      Object.values(group).map((rule) => rule.identifier);

    it('should limit login by address, email, and device', () => {
      expect(dimensionsOf(RateLimitPolicies.Auth.Login)).toEqual(
        expect.arrayContaining([
          RateLimitIdentifier.IP,
          RateLimitIdentifier.EMAIL,
          RateLimitIdentifier.DEVICE
        ])
      );
    });

    it('should limit verification by address, email, code, and device', () => {
      expect(dimensionsOf(RateLimitPolicies.Auth.Verify)).toEqual(
        expect.arrayContaining([
          RateLimitIdentifier.IP,
          RateLimitIdentifier.EMAIL,
          RateLimitIdentifier.VERIFICATION_CODE,
          RateLimitIdentifier.DEVICE
        ])
      );
    });

    it('should limit resend by address, email, and device', () => {
      expect(dimensionsOf(RateLimitPolicies.Auth.Resend)).toEqual(
        expect.arrayContaining([
          RateLimitIdentifier.IP,
          RateLimitIdentifier.EMAIL,
          RateLimitIdentifier.DEVICE
        ])
      );
    });

    it('should count verification codes separately from email addresses', () => {
      expect(RateLimitPolicies.Auth.Verify.Code.identifier).not.toBe(
        RateLimitPolicies.Auth.Verify.Email.identifier
      );
    });
  });

  describe('fail-closed policies', () => {
    // A Redis outage must not become an open door on the endpoints that guard
    // credentials and verification codes.
    it.each([
      ['auth.login.ip', RateLimitPolicies.Auth.Login.IP],
      ['auth.login.email', RateLimitPolicies.Auth.Login.Email],
      ['auth.login.device', RateLimitPolicies.Auth.Login.Device],
      ['auth.verify.code', RateLimitPolicies.Auth.Verify.Code]
    ])('%s should fail closed', (_name, rule) => {
      expect(rule.failOpen).toBe(false);
    });
  });

  describe('absorbed verification behaviour', () => {
    // These lock the semantics inherited from the service this framework
    // replaced, so a future edit cannot loosen them unnoticed.
    it('should keep the attempt window aligned with the code lifetime', () => {
      expect(ImperativeRateLimitPolicies.VerificationAttempts.windowMs).toBe(
        3 * TimeConstants.MS_PER_MINUTE
      );
      expect(ImperativeRateLimitPolicies.VerificationAttempts.limit).toBe(5);
    });

    it('should keep the resend cooldown at one per minute', () => {
      expect(ImperativeRateLimitPolicies.ResendCooldown.limit).toBe(1);
      expect(ImperativeRateLimitPolicies.ResendCooldown.windowMs).toBe(
        60 * TimeConstants.MS_PER_SECOND
      );
    });

    it('should keep the hourly resend allowance at five', () => {
      expect(ImperativeRateLimitPolicies.ResendHourly.limit).toBe(5);
      expect(ImperativeRateLimitPolicies.ResendHourly.windowMs).toBe(
        TimeConstants.MS_PER_HOUR
      );
    });
  });
});
