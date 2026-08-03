import { Request } from 'express';
import { RateLimitResolverRegistry } from '../../resolvers/rate-limit-resolver.registry';
import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { RateLimitResult } from '../../types/rate-limit-result.interface';
import { RateLimitRule } from '../../types/rate-limit-rule.interface';
import { RateLimitEvaluatorService } from '../rate-limit-evaluator.service';
import { RateLimitLogService } from '../rate-limit-log.service';
import { IRateLimitService } from '../rate-limit.service';

const ROUTE_KEY = 'AuthController.loginUser';

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

const allowed = (
  remaining: number,
  policy = 'auth.login.ip'
): RateLimitResult => ({
  policy,
  allowed: true,
  limit: 10,
  remaining,
  resetAt: 1_700_000_000_000,
  retryAfterSeconds: 0,
  blocked: false,
  degraded: false
});

const denied = (policy: string, retryAfterSeconds = 60): RateLimitResult => ({
  policy,
  allowed: false,
  limit: 10,
  remaining: 0,
  resetAt: 1_700_000_000_000,
  retryAfterSeconds,
  blocked: false,
  degraded: false
});

describe('RateLimitEvaluatorService', () => {
  let service: RateLimitEvaluatorService;

  const mockRegistry = {
    get: jest.fn()
  };

  const mockRateLimitService = {
    consume: jest.fn(),
    peek: jest.fn(),
    reset: jest.fn()
  };

  const mockLogService = {
    record: jest.fn(),
    skipped: jest.fn()
  };

  const request = { ip: '203.0.113.10' } as Request;

  /** Every dimension resolves to a value unless a test says otherwise. */
  const resolvingTo = (value: string | null) => ({ resolve: () => value });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRegistry.get.mockReturnValue(resolvingTo('value'));

    service = new RateLimitEvaluatorService(
      mockRegistry as unknown as RateLimitResolverRegistry,
      mockRateLimitService as unknown as IRateLimitService,
      mockLogService as unknown as RateLimitLogService
    );
  });

  describe('when every rule passes', () => {
    it('should allow the request', async () => {
      mockRateLimitService.consume.mockResolvedValue(allowed(4));

      const decision = await service.evaluate(request, ROUTE_KEY, [rule()]);

      expect(decision.allowed).toBe(true);
      expect(decision.retryAfterSeconds).toBe(0);
    });

    it('should consume every rule in the group', async () => {
      mockRateLimitService.consume.mockResolvedValue(allowed(4));

      await service.evaluate(request, ROUTE_KEY, [
        rule({ name: 'auth.login.ip' }),
        rule({
          name: 'auth.login.email',
          identifier: RateLimitIdentifier.EMAIL
        }),
        rule({
          name: 'auth.login.device',
          identifier: RateLimitIdentifier.DEVICE
        })
      ]);

      expect(mockRateLimitService.consume).toHaveBeenCalledTimes(3);
    });

    it('should report the rule with the least headroom', async () => {
      mockRateLimitService.consume
        .mockResolvedValueOnce(allowed(8, 'auth.login.ip'))
        .mockResolvedValueOnce(allowed(1, 'auth.login.email'))
        .mockResolvedValueOnce(allowed(5, 'auth.login.device'));

      const decision = await service.evaluate(request, ROUTE_KEY, [
        rule({ name: 'auth.login.ip' }),
        rule({
          name: 'auth.login.email',
          identifier: RateLimitIdentifier.EMAIL
        }),
        rule({
          name: 'auth.login.device',
          identifier: RateLimitIdentifier.DEVICE
        })
      ]);

      expect(decision.result?.policy).toBe('auth.login.email');
      expect(decision.result?.remaining).toBe(1);
    });

    it('should log every consumed rule', async () => {
      mockRateLimitService.consume.mockResolvedValue(allowed(4));

      await service.evaluate(request, ROUTE_KEY, [rule(), rule()]);

      expect(mockLogService.record).toHaveBeenCalledTimes(2);
    });
  });

  describe('when a rule denies', () => {
    it('should deny the request', async () => {
      mockRateLimitService.consume.mockResolvedValue(
        denied('auth.login.ip', 45)
      );

      const decision = await service.evaluate(request, ROUTE_KEY, [rule()]);

      expect(decision.allowed).toBe(false);
      expect(decision.retryAfterSeconds).toBe(45);
      expect(decision.result?.policy).toBe('auth.login.ip');
    });

    it('should stop at the first denial rather than draining later buckets', async () => {
      // Consuming the whole group would spend the device budget on a request
      // already rejected by the address rule.
      mockRateLimitService.consume.mockResolvedValueOnce(
        denied('auth.login.ip')
      );

      await service.evaluate(request, ROUTE_KEY, [
        rule({ name: 'auth.login.ip' }),
        rule({
          name: 'auth.login.email',
          identifier: RateLimitIdentifier.EMAIL
        }),
        rule({
          name: 'auth.login.device',
          identifier: RateLimitIdentifier.DEVICE
        })
      ]);

      expect(mockRateLimitService.consume).toHaveBeenCalledTimes(1);
    });

    it('should still deny when the failing rule is last', async () => {
      mockRateLimitService.consume
        .mockResolvedValueOnce(allowed(4))
        .mockResolvedValueOnce(denied('auth.login.email'));

      const decision = await service.evaluate(request, ROUTE_KEY, [
        rule({ name: 'auth.login.ip' }),
        rule({
          name: 'auth.login.email',
          identifier: RateLimitIdentifier.EMAIL
        })
      ]);

      expect(decision.allowed).toBe(false);
      expect(decision.result?.policy).toBe('auth.login.email');
    });
  });

  describe('rules that do not apply', () => {
    it('should skip a rule whose dimension the request lacks', async () => {
      mockRegistry.get.mockReturnValue(resolvingTo(null));

      const decision = await service.evaluate(request, ROUTE_KEY, [rule()]);

      expect(mockRateLimitService.consume).not.toHaveBeenCalled();
      expect(mockLogService.skipped).toHaveBeenCalled();
      expect(decision.allowed).toBe(true);
    });

    it('should keep applying the remaining rules after a skip', async () => {
      mockRegistry.get
        .mockReturnValueOnce(resolvingTo(null))
        .mockReturnValueOnce(resolvingTo('user-1'));
      mockRateLimitService.consume.mockResolvedValue(denied('auth.login.user'));

      const decision = await service.evaluate(request, ROUTE_KEY, [
        rule({
          name: 'auth.login.email',
          identifier: RateLimitIdentifier.EMAIL
        }),
        rule({ name: 'auth.login.user', identifier: RateLimitIdentifier.USER })
      ]);

      expect(decision.allowed).toBe(false);
    });

    it('should skip a disabled rule without resolving it', async () => {
      const decision = await service.evaluate(request, ROUTE_KEY, [
        rule({ enabled: false })
      ]);

      expect(mockRegistry.get).not.toHaveBeenCalled();
      expect(mockRateLimitService.consume).not.toHaveBeenCalled();
      expect(decision.allowed).toBe(true);
    });

    it('should allow with no result when every rule was skipped', async () => {
      mockRegistry.get.mockReturnValue(resolvingTo(null));

      const decision = await service.evaluate(request, ROUTE_KEY, [
        rule(),
        rule()
      ]);

      expect(decision.allowed).toBe(true);
      expect(decision.result).toBeNull();
    });

    it('should allow when the group is empty', async () => {
      const decision = await service.evaluate(request, ROUTE_KEY, []);

      expect(decision.allowed).toBe(true);
      expect(decision.result).toBeNull();
    });
  });

  describe('resolution context', () => {
    it('should pass the request, route key, and rule to the resolver', async () => {
      const resolve = jest.fn(() => 'value');
      mockRegistry.get.mockReturnValue({ resolve });
      mockRateLimitService.consume.mockResolvedValue(allowed(4));

      const target = rule();

      await service.evaluate(request, ROUTE_KEY, [target]);

      expect(resolve).toHaveBeenCalledWith({
        request,
        routeKey: ROUTE_KEY,
        rule: target
      });
    });
  });
});
