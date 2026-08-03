import { AppError } from '@core/errors/app.error';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityErrorCode } from '../../../errors/security-error-code.enum';
import { RateLimitPolicies } from '../../config/rate-limit.config';
import { RateLimitEvaluatorService } from '../../services/rate-limit-evaluator.service';
import { RateLimitDecision } from '../../types/rate-limit-result.interface';
import { RateLimitGuard } from '../rate-limit.guard';

const NOW_MS = 1_700_000_000_000;

const allowedDecision = (
  overrides: Partial<RateLimitDecision['result']> = {}
): RateLimitDecision => ({
  allowed: true,
  result: {
    policy: 'auth.login.ip',
    allowed: true,
    limit: 5,
    remaining: 3,
    resetAt: NOW_MS,
    retryAfterSeconds: 0,
    blocked: false,
    degraded: false,
    ...overrides
  },
  retryAfterSeconds: 0
});

const deniedDecision = (retryAfterSeconds = 45): RateLimitDecision => ({
  allowed: false,
  result: {
    policy: 'auth.login.email',
    allowed: false,
    limit: 10,
    remaining: 0,
    resetAt: NOW_MS,
    retryAfterSeconds,
    blocked: false,
    degraded: false
  },
  retryAfterSeconds
});

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;

  const mockEvaluator = {
    evaluate: jest.fn()
  };

  const setHeader = jest.fn();

  class AuthController {
    loginUser() {}
  }

  const mockContext = (
    request: Record<string, unknown> = { ip: '203.0.113.10' }
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader })
      }),
      getHandler: () => AuthController.prototype.loginUser,
      getClass: () => AuthController
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // A real reflector with a spy, matching the CSRF guard spec.
    reflector = new Reflector();
    guard = new RateLimitGuard(
      reflector,
      mockEvaluator as unknown as RateLimitEvaluatorService
    );
  });

  const withMetadata = (rules: unknown) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(rules as never);

  describe('routes without a policy', () => {
    it('should allow when no metadata is present', async () => {
      withMetadata(undefined);

      await expect(guard.canActivate(mockContext())).resolves.toBe(true);
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should allow when the metadata carries no rules', async () => {
      withMetadata({ rules: [] });

      await expect(guard.canActivate(mockContext())).resolves.toBe(true);
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('metadata lookup', () => {
    it('should read handler and class so a class-level policy applies', async () => {
      const spy = withMetadata(undefined);

      await guard.canActivate(mockContext());

      expect(spy).toHaveBeenCalledWith('rate_limit', [
        AuthController.prototype.loginUser,
        AuthController
      ]);
    });
  });

  describe('when the request is allowed', () => {
    beforeEach(() => {
      withMetadata({ rules: [RateLimitPolicies.Auth.Login.IP] });
      mockEvaluator.evaluate.mockResolvedValue(allowedDecision());
    });

    it('should let the request through', async () => {
      await expect(guard.canActivate(mockContext())).resolves.toBe(true);
    });

    it('should advertise the budget', async () => {
      await guard.canActivate(mockContext());

      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '3');
      expect(setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        String(Math.ceil(NOW_MS / 1000))
      );
    });

    it('should set no headers when every rule was skipped', async () => {
      mockEvaluator.evaluate.mockResolvedValue({
        allowed: true,
        result: null,
        retryAfterSeconds: 0
      });

      await guard.canActivate(mockContext());

      expect(setHeader).not.toHaveBeenCalled();
    });
  });

  describe('when the request is denied', () => {
    beforeEach(() => {
      withMetadata({ rules: [RateLimitPolicies.Auth.Login.Email] });
      mockEvaluator.evaluate.mockResolvedValue(deniedDecision());
    });

    it('should throw a 429 with the rate limit code', async () => {
      await expect(guard.canActivate(mockContext())).rejects.toMatchObject({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: SecurityErrorCode.RATE_LIMIT_EXCEEDED
      });
    });

    it('should carry the retry hint in the error metadata', async () => {
      const error = await guard
        .canActivate(mockContext())
        .catch((thrown: AppError) => thrown);

      expect((error as AppError).metadata).toEqual({ retryAfter: 45 });
    });

    it('should still advertise the budget on the rejection', async () => {
      await guard.canActivate(mockContext()).catch(() => undefined);

      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });

    it('should not disclose which policy tripped', async () => {
      const error = await guard
        .canActivate(mockContext())
        .catch((thrown: AppError) => thrown);

      expect(JSON.stringify((error as AppError).metadata)).not.toContain(
        'auth.login.email'
      );
      expect((error as AppError).message).toBe(
        'Too many requests. Please try again later.'
      );
    });
  });

  describe('route key', () => {
    it('should identify the handler, not the request path', async () => {
      // The old implementation fell back to request.url, so `?x=1` minted a
      // fresh bucket.
      withMetadata({ rules: [RateLimitPolicies.Auth.Login.IP] });
      mockEvaluator.evaluate.mockResolvedValue(allowedDecision());

      await guard.canActivate(
        mockContext({ ip: '203.0.113.10', url: '/v1/auth/login?bypass=1' })
      );

      expect(mockEvaluator.evaluate).toHaveBeenCalledWith(
        expect.anything(),
        'AuthController.loginUser',
        expect.anything()
      );
    });
  });
});
