import { RateLimitPolicies } from '../../config/rate-limit.config';
import { RATE_LIMIT_KEY } from '../../rate-limit.constants';
import { RateLimitMetadata } from '../../types/rate-limit-rule.interface';
import { RateLimit } from '../rate-limit.decorator';

/** Applies the decorator to a throwaway method and reads the metadata back. */
const metadataFor = (
  decorator: MethodDecorator & ClassDecorator
): RateLimitMetadata => {
  class Target {
    handler() {}
  }

  decorator(Target.prototype, 'handler', {
    value: Target.prototype.handler
  } as PropertyDescriptor);

  return Reflect.getMetadata(RATE_LIMIT_KEY, Target.prototype.handler);
};

describe('RateLimit decorator', () => {
  describe('policy group form', () => {
    it('should store every rule in the group', () => {
      const metadata = metadataFor(RateLimit(RateLimitPolicies.Auth.Login));

      expect(metadata.rules).toHaveLength(3);
    });

    it('should preserve the declared order', () => {
      // Order matters: evaluation is fail-fast, and the config declares the
      // broadest dimension first.
      const metadata = metadataFor(RateLimit(RateLimitPolicies.Auth.Login));

      expect(metadata.rules.map((rule) => rule.name)).toEqual([
        'auth.login.ip',
        'auth.login.email',
        'auth.login.device'
      ]);
    });

    it('should store rule references rather than copies', () => {
      // The guard reads these straight back, so a custom rule's key generator
      // closure has to survive the round trip.
      const metadata = metadataFor(RateLimit(RateLimitPolicies.Auth.Login));

      expect(metadata.rules[0]).toBe(RateLimitPolicies.Auth.Login.IP);
    });

    it('should capture all four verification dimensions', () => {
      const metadata = metadataFor(RateLimit(RateLimitPolicies.Auth.Verify));

      expect(metadata.rules.map((rule) => rule.name)).toEqual([
        'auth.verify.ip',
        'auth.verify.device',
        'auth.verify.email',
        'auth.verify.code'
      ]);
    });
  });

  describe('explicit policy list form', () => {
    it('should store exactly the listed rules', () => {
      const metadata = metadataFor(
        RateLimit({
          policies: [
            RateLimitPolicies.Auth.Login.IP,
            RateLimitPolicies.Auth.Login.Email
          ]
        })
      );

      expect(metadata.rules.map((rule) => rule.name)).toEqual([
        'auth.login.ip',
        'auth.login.email'
      ]);
    });

    it('should allow combining rules from different groups', () => {
      const metadata = metadataFor(
        RateLimit({
          policies: [
            RateLimitPolicies.Auth.Login.IP,
            RateLimitPolicies.CoinTracker.Alert.User
          ]
        })
      );

      expect(metadata.rules.map((rule) => rule.name)).toEqual([
        'auth.login.ip',
        'coinTracker.alert.user'
      ]);
    });

    it('should accept an empty list', () => {
      expect(metadataFor(RateLimit({ policies: [] })).rules).toEqual([]);
    });
  });

  describe('class-level application', () => {
    it('should attach the metadata to the class', () => {
      @RateLimit(RateLimitPolicies.CoinTracker.Alert)
      class Controller {}

      const metadata: RateLimitMetadata = Reflect.getMetadata(
        RATE_LIMIT_KEY,
        Controller
      );

      expect(metadata.rules.map((rule) => rule.name)).toEqual([
        'coinTracker.alert.ip',
        'coinTracker.alert.user'
      ]);
    });
  });
});
