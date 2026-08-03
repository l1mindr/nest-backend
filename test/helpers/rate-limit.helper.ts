import { RateLimitKeyBuilder } from '@features/security/rate-limit/services/rate-limit-key.builder';
import {
  IRateLimitService,
  RATE_LIMIT_SERVICE
} from '@features/security/rate-limit/services/rate-limit.service';
import { RateLimitRule } from '@features/security/rate-limit/types/rate-limit-rule.interface';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { INestApplication } from '@nestjs/common';

/**
 * Rate-limit keys are HMAC'd, so a test cannot build one by hand. Resolving the
 * real key builder out of the container keeps the hashing rules in one place.
 */
export const counterKeyFor = (
  app: INestApplication,
  rule: RateLimitRule,
  value: string
): string => app.get(RateLimitKeyBuilder).counterKey(rule, value);

export const blockKeyFor = (
  app: INestApplication,
  rule: RateLimitRule,
  value: string
): string => app.get(RateLimitKeyBuilder).blockKey(rule, value);

/** Clears a policy's counter and any block for one identifier. */
export const resetPolicy = (
  app: INestApplication,
  rule: RateLimitRule,
  value: string
): Promise<void> =>
  app.get<IRateLimitService>(RATE_LIMIT_SERVICE).reset(rule, value);

/**
 * Collapses a key's TTL and waits for Redis to actually drop it.
 *
 * Lets a test observe a genuine window expiry without sleeping for the real
 * window, which would be minutes. Mirrors the approach in
 * `test/integration/redis-lock.e2e-spec.ts`.
 */
export const forceExpiry = async (
  app: INestApplication,
  key: string,
  timeoutMs = 2_000
): Promise<void> => {
  const client = app.get(RedisService).client;

  await client.pexpire(key, 1);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if ((await client.exists(key)) === 0) return;

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Key "${key}" did not expire within ${timeoutMs}ms`);
};
