import { ClockService } from '@infrastructure/clock/clock.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { RateLimitResult } from '../types/rate-limit-result.interface';
import { RateLimitRule } from '../types/rate-limit-rule.interface';
import { RateLimitKeyBuilder } from './rate-limit-key.builder';

/** Positions in the array every script returns. */
const ALLOWED = 0;
const COUNT = 1;
const RESET_AFTER_MS = 2;
const BLOCKED = 3;

@Injectable()
export class RateLimitStoreService {
  /**
   * Fixed window with a separate temporary-block flag.
   *
   * Redis runs an EVAL body as a single unit on its command thread, so nothing
   * interleaves between the block check, the increment, the expiry, and the
   * block write. Two requests arriving together at the limit therefore cannot
   * both observe headroom: one sees `limit`, the other `limit + 1`.
   */
  private static readonly CONSUME_SCRIPT = `
    local counterKey = KEYS[1]
    local blockKey   = KEYS[2]
    local limit      = tonumber(ARGV[1])
    local windowMs   = tonumber(ARGV[2])
    local blockMs    = tonumber(ARGV[3])
    local cost       = tonumber(ARGV[4])

    -- An active block short-circuits everything. The counter is never touched
    -- while blocked, so a caller hammering the endpoint cannot extend its own
    -- penalty: the block lasts exactly blockMs from the moment it was tripped.
    local blockTtl = redis.call('pttl', blockKey)
    if blockTtl > 0 then
      return { 0, -1, blockTtl, 1 }
    end

    -- The expiry is attached on the first hit only, so the window never slides
    -- forward under sustained traffic.
    local count = redis.call('incrby', counterKey, cost)
    if count == cost then
      redis.call('pexpire', counterKey, windowMs)
    end

    local ttl = redis.call('pttl', counterKey)
    if ttl < 0 then
      -- Defensive: a counter that somehow exists without a TTL would otherwise
      -- never reset.
      redis.call('pexpire', counterKey, windowMs)
      ttl = windowMs
    end

    if count > limit then
      if blockMs > 0 then
        -- Open the block and drop the counter, so the window restarts clean
        -- once the block lifts.
        redis.call('set', blockKey, '1', 'PX', blockMs)
        redis.call('del', counterKey)
        return { 0, count, blockMs, 1 }
      end
      return { 0, count, ttl, 0 }
    end

    return { 1, count, ttl, 0 }
  `;

  /** Read-only counterpart to CONSUME: reports state without spending budget. */
  private static readonly PEEK_SCRIPT = `
    local counterKey = KEYS[1]
    local blockKey   = KEYS[2]
    local limit      = tonumber(ARGV[1])

    local blockTtl = redis.call('pttl', blockKey)
    if blockTtl > 0 then
      return { 0, -1, blockTtl, 1 }
    end

    local count = tonumber(redis.call('get', counterKey)) or 0
    local ttl = redis.call('pttl', counterKey)
    if ttl < 0 then ttl = 0 end

    if count > limit then
      return { 0, count, ttl, 0 }
    end

    return { 1, count, ttl, 0 }
  `;

  /** Counter and block cleared together, so a reset always clears a policy fully. */
  private static readonly RESET_SCRIPT = `
    return redis.call('del', KEYS[1], KEYS[2])
  `;

  constructor(
    private readonly redisService: RedisService,
    private readonly keyBuilder: RateLimitKeyBuilder,
    private readonly clockService: ClockService
  ) {}

  async consume(
    rule: RateLimitRule,
    value: string,
    cost = 1
  ): Promise<RateLimitResult> {
    return this.run(rule, value, RateLimitStoreService.CONSUME_SCRIPT, [
      rule.limit,
      rule.windowMs,
      rule.blockDurationMs,
      cost
    ]);
  }

  async peek(rule: RateLimitRule, value: string): Promise<RateLimitResult> {
    return this.run(rule, value, RateLimitStoreService.PEEK_SCRIPT, [
      rule.limit
    ]);
  }

  async reset(rule: RateLimitRule, value: string): Promise<void> {
    await this.redisService.eval(RateLimitStoreService.RESET_SCRIPT, [
      this.keyBuilder.counterKey(rule, value),
      this.keyBuilder.blockKey(rule, value)
    ]);
  }

  private async run(
    rule: RateLimitRule,
    value: string,
    script: string,
    args: number[]
  ): Promise<RateLimitResult> {
    try {
      const raw = (await this.redisService.eval(
        script,
        [
          this.keyBuilder.counterKey(rule, value),
          this.keyBuilder.blockKey(rule, value)
        ],
        ...args
      )) as number[];

      return this.toResult(rule, raw);
    } catch {
      // The caller logs this; rethrowing would turn a Redis blip into a 500.
      return this.degradedResult(rule);
    }
  }

  private toResult(rule: RateLimitRule, raw: number[]): RateLimitResult {
    const allowed = Number(raw[ALLOWED]) === 1;
    const count = Number(raw[COUNT]);
    const resetAfterMs = Number(raw[RESET_AFTER_MS]);
    const blocked = Number(raw[BLOCKED]) === 1;

    return {
      policy: rule.name,
      allowed,
      limit: rule.limit,
      // A blocked caller reports count -1; clamp so remaining is never negative.
      remaining: count < 0 ? 0 : Math.max(rule.limit - count, 0),
      // Redis owns expiry and reports it as a duration; the clock service turns
      // that into an instant, keeping wall-clock time injectable for tests and
      // the script free of replication and clock-skew hazards.
      resetAt: this.clockService.nowMs() + resetAfterMs,
      retryAfterSeconds: this.toRetryAfterSeconds(resetAfterMs),
      blocked,
      degraded: false
    };
  }

  private degradedResult(rule: RateLimitRule): RateLimitResult {
    return {
      policy: rule.name,
      allowed: rule.failOpen,
      limit: rule.limit,
      remaining: 0,
      resetAt: this.clockService.nowMs() + rule.windowMs,
      retryAfterSeconds: this.toRetryAfterSeconds(rule.windowMs),
      blocked: false,
      degraded: true
    };
  }

  private toRetryAfterSeconds(ms: number): number {
    if (ms <= 0) return 0;

    // Round up: advertising a shorter wait than reality invites a retry that is
    // certain to be rejected again.
    return Math.ceil(ms / TimeConstants.MS_PER_SECOND);
  }
}
