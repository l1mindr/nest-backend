import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RateLimitResolverRegistry } from '../resolvers/rate-limit-resolver.registry';
import {
  RateLimitDecision,
  RateLimitResult
} from '../types/rate-limit-result.interface';
import { RateLimitRule } from '../types/rate-limit-rule.interface';
import { RateLimitLogService } from './rate-limit-log.service';
import { IRateLimitService, RATE_LIMIT_SERVICE } from './rate-limit.service';

@Injectable()
export class RateLimitEvaluatorService {
  constructor(
    private readonly registry: RateLimitResolverRegistry,
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimitService: IRateLimitService,
    private readonly logService: RateLimitLogService
  ) {}

  /**
   * Applies every rule in a group; the request proceeds only if all of them
   * pass.
   *
   * Evaluation is sequential and stops at the first denial. Consuming the whole
   * group in parallel would drain the address bucket for a request already
   * doomed on its email dimension — punishing every co-located user for one
   * attacker, and inflating counters with requests that were never served.
   * Nothing escapes through the early exit: a rule left unconsumed belongs to a
   * request that is being rejected anyway.
   */
  async evaluate(
    request: Request,
    routeKey: string,
    rules: readonly RateLimitRule[]
  ): Promise<RateLimitDecision> {
    let tightest: RateLimitResult | null = null;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const value = this.registry
        .get(rule.identifier)
        .resolve({ request, routeKey, rule });

      if (value === null) {
        this.logService.skipped(rule, routeKey);
        continue;
      }

      const result = await this.rateLimitService.consume(rule, value);

      this.logService.record(rule, routeKey, value, result);

      if (!result.allowed) {
        return {
          allowed: false,
          result,
          retryAfterSeconds: result.retryAfterSeconds
        };
      }

      // The headers advertise the rule closest to its limit, which is the one
      // that will actually stop the caller next.
      if (!tightest || result.remaining < tightest.remaining) {
        tightest = result;
      }
    }

    return { allowed: true, result: tightest, retryAfterSeconds: 0 };
  }
}
