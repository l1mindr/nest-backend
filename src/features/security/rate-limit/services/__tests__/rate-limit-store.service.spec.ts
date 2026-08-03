import { ClockService } from '@infrastructure/clock/clock.service';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { RateLimitRule } from '../../types/rate-limit-rule.interface';
import { RateLimitKeyBuilder } from '../rate-limit-key.builder';
import { RateLimitStoreService } from '../rate-limit-store.service';

const NOW_MS = 1_700_000_000_000;

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

describe('RateLimitStoreService', () => {
  let service: RateLimitStoreService;

  const mockRedisService = {
    eval: jest.fn()
  };

  const mockKeyBuilder = {
    counterKey: jest.fn(() => 'rl:login:ip:hash'),
    blockKey: jest.fn(() => 'rl:login:ip:hash:blocked')
  };

  const mockClockService = {
    nowMs: jest.fn(() => NOW_MS)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockKeyBuilder.counterKey.mockReturnValue('rl:login:ip:hash');
    mockKeyBuilder.blockKey.mockReturnValue('rl:login:ip:hash:blocked');
    mockClockService.nowMs.mockReturnValue(NOW_MS);

    service = new RateLimitStoreService(
      mockRedisService as unknown as RedisService,
      mockKeyBuilder as unknown as RateLimitKeyBuilder,
      mockClockService as unknown as ClockService
    );
  });

  describe('consume', () => {
    it('should pass both keys and the rule arguments in order', async () => {
      mockRedisService.eval.mockResolvedValue([1, 1, 60_000, 0]);

      await service.consume(rule({ blockDurationMs: 300_000 }), '203.0.113.10');

      const [script, keys, ...args] = mockRedisService.eval.mock.calls[0];

      expect(typeof script).toBe('string');
      expect(keys).toEqual(['rl:login:ip:hash', 'rl:login:ip:hash:blocked']);
      expect(args).toEqual([5, 60_000, 300_000, 1]);
    });

    it('should perform the whole decision in one script', () => {
      // Atomicity is the point: splitting these into separate round-trips would
      // let two concurrent requests both observe headroom at the limit.
      const script = (RateLimitStoreService as any).CONSUME_SCRIPT as string;

      expect(script).toContain("redis.call('pttl', blockKey)");
      expect(script).toContain("redis.call('incrby', counterKey, cost)");
      expect(script).toContain("redis.call('pexpire', counterKey, windowMs)");
      expect(script).toContain(
        "redis.call('set', blockKey, '1', 'PX', blockMs)"
      );
    });

    it('should forward a custom cost', async () => {
      mockRedisService.eval.mockResolvedValue([1, 3, 60_000, 0]);

      await service.consume(rule(), '203.0.113.10', 3);

      const args = mockRedisService.eval.mock.calls[0].slice(2);

      expect(args[3]).toBe(3);
    });

    it('should map an allowed response', async () => {
      mockRedisService.eval.mockResolvedValue([1, 2, 45_000, 0]);

      const result = await service.consume(rule(), '203.0.113.10');

      expect(result).toEqual({
        policy: 'auth.login.ip',
        allowed: true,
        limit: 5,
        remaining: 3,
        resetAt: NOW_MS + 45_000,
        retryAfterSeconds: 45,
        blocked: false,
        degraded: false
      });
    });

    it('should derive resetAt from the injected clock', async () => {
      mockRedisService.eval.mockResolvedValue([1, 1, 30_000, 0]);
      mockClockService.nowMs.mockReturnValue(999_000);

      const result = await service.consume(rule(), '203.0.113.10');

      expect(result.resetAt).toBe(999_000 + 30_000);
    });

    it('should report no headroom once the limit is reached', async () => {
      mockRedisService.eval.mockResolvedValue([0, 6, 30_000, 0]);

      const result = await service.consume(rule(), '203.0.113.10');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.blocked).toBe(false);
    });

    it('should map an active block', async () => {
      mockRedisService.eval.mockResolvedValue([0, -1, 120_000, 1]);

      const result = await service.consume(rule(), '203.0.113.10');

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(120);
    });

    it('should round the retry hint up to the next whole second', async () => {
      mockRedisService.eval.mockResolvedValue([0, 6, 1_200, 0]);

      const result = await service.consume(rule(), '203.0.113.10');

      expect(result.retryAfterSeconds).toBe(2);
    });

    describe('when Redis is unreachable', () => {
      beforeEach(() => {
        mockRedisService.eval.mockRejectedValue(new Error('ECONNRESET'));
      });

      it('should allow the request for a fail-open rule', async () => {
        const result = await service.consume(
          rule({ failOpen: true }),
          '203.0.113.10'
        );

        expect(result.allowed).toBe(true);
        expect(result.degraded).toBe(true);
      });

      it('should deny the request for a fail-closed rule', async () => {
        const result = await service.consume(
          rule({ failOpen: false }),
          '203.0.113.10'
        );

        expect(result.allowed).toBe(false);
        expect(result.degraded).toBe(true);
      });

      it('should not propagate the error as a server fault', async () => {
        await expect(
          service.consume(rule(), '203.0.113.10')
        ).resolves.toBeDefined();
      });

      it('should advertise a retry hint based on the rule window', async () => {
        const result = await service.consume(
          rule({ windowMs: 120_000 }),
          '203.0.113.10'
        );

        expect(result.retryAfterSeconds).toBe(120);
      });
    });
  });

  describe('peek', () => {
    it('should never mutate the counter', () => {
      const script = (RateLimitStoreService as any).PEEK_SCRIPT as string;

      expect(script).not.toContain('incrby');
      expect(script).not.toContain('pexpire');
      expect(script).toContain("redis.call('get', counterKey)");
    });

    it('should pass only the limit', async () => {
      mockRedisService.eval.mockResolvedValue([1, 2, 30_000, 0]);

      await service.peek(rule(), '203.0.113.10');

      const args = mockRedisService.eval.mock.calls[0].slice(2);

      expect(args).toEqual([5]);
    });

    it('should report remaining headroom', async () => {
      mockRedisService.eval.mockResolvedValue([1, 2, 30_000, 0]);

      const result = await service.peek(rule(), '203.0.113.10');

      expect(result.remaining).toBe(3);
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear the counter and the block together', async () => {
      mockRedisService.eval.mockResolvedValue(2);

      await service.reset(rule(), '203.0.113.10');

      const [script, keys] = mockRedisService.eval.mock.calls[0];

      expect(script).toContain('del');
      expect(keys).toEqual(['rl:login:ip:hash', 'rl:login:ip:hash:blocked']);
    });
  });
});
