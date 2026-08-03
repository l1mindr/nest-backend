import { Injectable } from '@nestjs/common';
import { RateLimitResult } from '../types/rate-limit-result.interface';
import { RateLimitRule } from '../types/rate-limit-rule.interface';
import { RateLimitStoreService } from './rate-limit-store.service';

export const RATE_LIMIT_SERVICE = Symbol('IRateLimitService');

export interface IRateLimitService {
  /** Spends one unit of budget and reports the outcome. */
  consume(
    rule: RateLimitRule,
    value: string,
    cost?: number
  ): Promise<RateLimitResult>;

  /** Reports the current state without spending budget. */
  peek(rule: RateLimitRule, value: string): Promise<RateLimitResult>;

  /** Clears the counter and any block for one identifier under one rule. */
  reset(rule: RateLimitRule, value: string): Promise<void>;
}

/**
 * The framework's counting entry point.
 *
 * The guard reaches it through the evaluator; use cases call it directly when
 * they must react to the outcome rather than answer 429 — invalidating a
 * verification code, or skipping a resend silently. Both paths share one
 * implementation, so there is a single definition of what a limit means.
 *
 * A disabled rule is always allowed, and consumes nothing: toggling `enabled`
 * off in the config is enough to take a policy out of service.
 */
@Injectable()
export class RateLimitService implements IRateLimitService {
  constructor(private readonly store: RateLimitStoreService) {}

  async consume(
    rule: RateLimitRule,
    value: string,
    cost = 1
  ): Promise<RateLimitResult> {
    if (!rule.enabled) return this.disabledResult(rule);

    return this.store.consume(rule, value, cost);
  }

  async peek(rule: RateLimitRule, value: string): Promise<RateLimitResult> {
    if (!rule.enabled) return this.disabledResult(rule);

    return this.store.peek(rule, value);
  }

  async reset(rule: RateLimitRule, value: string): Promise<void> {
    await this.store.reset(rule, value);
  }

  private disabledResult(rule: RateLimitRule): RateLimitResult {
    return {
      policy: rule.name,
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      resetAt: 0,
      retryAfterSeconds: 0,
      blocked: false,
      degraded: false
    };
  }
}
