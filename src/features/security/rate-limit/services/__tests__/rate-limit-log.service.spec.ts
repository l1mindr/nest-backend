import { LogEvent } from '@infrastructure/logging/logging.constants';
import { PinoLogger } from 'nestjs-pino';
import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { RateLimitResult } from '../../types/rate-limit-result.interface';
import { RateLimitRule } from '../../types/rate-limit-rule.interface';
import { RateLimitKeyBuilder } from '../rate-limit-key.builder';
import { RateLimitLogService } from '../rate-limit-log.service';

const RAW_EMAIL = 'attacker@example.com';
const RAW_CODE = '123456';

const rule = (overrides: Partial<RateLimitRule> = {}): RateLimitRule => ({
  name: 'auth.login.email',
  identifier: RateLimitIdentifier.EMAIL,
  keyPrefix: 'login',
  limit: 10,
  windowMs: 900_000,
  blockDurationMs: 900_000,
  enabled: true,
  failOpen: false,
  ...overrides
});

const result = (overrides: Partial<RateLimitResult> = {}): RateLimitResult => ({
  policy: 'auth.login.email',
  allowed: true,
  limit: 10,
  remaining: 7,
  resetAt: 1_700_000_000_000,
  retryAfterSeconds: 0,
  blocked: false,
  degraded: false,
  ...overrides
});

describe('RateLimitLogService', () => {
  let service: RateLimitLogService;

  const mockKeyBuilder = {
    fingerprint: jest.fn(() => 'ab12cd34ef56')
  };

  const mockLogger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockKeyBuilder.fingerprint.mockReturnValue('ab12cd34ef56');

    service = new RateLimitLogService(
      mockKeyBuilder as unknown as RateLimitKeyBuilder,
      mockLogger as unknown as PinoLogger
    );
  });

  describe('event selection', () => {
    it('should debug-log an allowed request', () => {
      service.record(rule(), 'AuthController.loginUser', RAW_EMAIL, result());

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.RATE_LIMIT_ALLOWED }),
        'Rate limit consumed'
      );
    });

    it('should warn when a rule denies', () => {
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false, remaining: 0 })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.RATE_LIMIT_HIT }),
        'Rate limit reached'
      );
    });

    it('should warn when a block is in effect', () => {
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false, blocked: true, retryAfterSeconds: 900 })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.RATE_LIMIT_BLOCKED }),
        'Rate limit block in effect'
      );
    });

    it('should warn when the store is degraded and record the failure mode', () => {
      // This event is the operator's only warning before a fail-closed policy
      // starts rejecting real traffic.
      service.record(
        rule({ failOpen: false }),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false, degraded: true })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.RATE_LIMIT_DEGRADED,
          failOpen: false
        }),
        'Rate limit store unavailable'
      );
    });

    it('should prefer the degraded event over the denial event', () => {
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false, blocked: true, degraded: true })
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn.mock.calls[0][0].event).toBe(
        LogEvent.RATE_LIMIT_DEGRADED
      );
    });

    it('should debug-log a skipped rule', () => {
      service.skipped(rule(), 'AuthController.loginUser');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.RATE_LIMIT_SKIPPED,
          policy: 'auth.login.email',
          identifierType: RateLimitIdentifier.EMAIL
        }),
        'Rate limit rule skipped; identifier absent'
      );
    });
  });

  describe('log payload', () => {
    it('should carry the diagnostic fields an operator needs', () => {
      service.record(rule(), 'AuthController.loginUser', RAW_EMAIL, result());

      expect(mockLogger.debug.mock.calls[0][0]).toMatchObject({
        policy: 'auth.login.email',
        route: 'AuthController.loginUser',
        identifierType: RateLimitIdentifier.EMAIL,
        identifierHash: 'ab12cd34ef56',
        limit: 10,
        remaining: 7,
        resetAt: 1_700_000_000_000
      });
    });

    it('should hash the identifier rather than logging it', () => {
      service.record(rule(), 'AuthController.loginUser', RAW_EMAIL, result());

      expect(mockKeyBuilder.fingerprint).toHaveBeenCalledWith(
        expect.anything(),
        RAW_EMAIL
      );
    });
  });

  describe('sensitive value disclosure', () => {
    const serialisedCalls = () =>
      JSON.stringify([
        ...mockLogger.warn.mock.calls,
        ...mockLogger.debug.mock.calls
      ]);

    it('should never serialise a raw email address', () => {
      service.record(rule(), 'AuthController.loginUser', RAW_EMAIL, result());
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false })
      );
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ allowed: false, blocked: true })
      );
      service.record(
        rule(),
        'AuthController.loginUser',
        RAW_EMAIL,
        result({ degraded: true })
      );

      expect(serialisedCalls()).not.toContain(RAW_EMAIL);
      expect(serialisedCalls()).not.toContain('attacker');
    });

    it('should never serialise a raw verification code', () => {
      const codeRule = rule({
        name: 'auth.verify.code',
        identifier: RateLimitIdentifier.VERIFICATION_CODE,
        keyPrefix: 'verify'
      });

      service.record(
        codeRule,
        'AuthController.verifyEmail',
        RAW_CODE,
        result()
      );
      service.record(
        codeRule,
        'AuthController.verifyEmail',
        RAW_CODE,
        result({ allowed: false })
      );

      expect(serialisedCalls()).not.toContain(RAW_CODE);
    });
  });
});
