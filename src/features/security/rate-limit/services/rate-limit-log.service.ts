import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResult } from '../types/rate-limit-result.interface';
import { RateLimitRule } from '../types/rate-limit-rule.interface';
import { RateLimitKeyBuilder } from './rate-limit-key.builder';

/**
 * Everything a rate-limit log line may carry.
 *
 * There is deliberately no field for the raw identifier: the type makes it
 * impossible to log an address or a verification code even by accident. The
 * raw value travels resolver -> service -> key builder and stops there.
 */
interface RateLimitLogContext {
  readonly event: LogEvent;
  readonly policy: string;
  readonly route: string;
  readonly identifierType: RateLimitIdentifier;
  readonly identifierHash: string;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
}

/** The only place rate-limit events are emitted. */
@Injectable()
export class RateLimitLogService {
  constructor(
    private readonly keyBuilder: RateLimitKeyBuilder,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RateLimitLogService.name);
  }

  record(
    rule: RateLimitRule,
    routeKey: string,
    value: string,
    result: RateLimitResult
  ): void {
    const context = this.toContext(
      rule,
      routeKey,
      this.keyBuilder.fingerprint(rule, value),
      result
    );

    if (result.degraded) {
      this.logger.warn(
        {
          ...context,
          event: LogEvent.RATE_LIMIT_DEGRADED,
          failOpen: rule.failOpen
        },
        'Rate limit store unavailable'
      );
      return;
    }

    if (result.blocked) {
      this.logger.warn(
        { ...context, event: LogEvent.RATE_LIMIT_BLOCKED },
        'Rate limit block in effect'
      );
      return;
    }

    if (!result.allowed) {
      this.logger.warn(
        { ...context, event: LogEvent.RATE_LIMIT_HIT },
        'Rate limit reached'
      );
      return;
    }

    this.logger.debug(
      { ...context, event: LogEvent.RATE_LIMIT_ALLOWED },
      'Rate limit consumed'
    );
  }

  /** A rule whose dimension the request carried no value for. */
  skipped(rule: RateLimitRule, routeKey: string): void {
    this.logger.debug(
      {
        event: LogEvent.RATE_LIMIT_SKIPPED,
        policy: rule.name,
        route: routeKey,
        identifierType: rule.identifier
      },
      'Rate limit rule skipped; identifier absent'
    );
  }

  private toContext(
    rule: RateLimitRule,
    routeKey: string,
    identifierHash: string,
    result: RateLimitResult
  ): RateLimitLogContext {
    return {
      event: LogEvent.RATE_LIMIT_ALLOWED,
      policy: rule.name,
      route: routeKey,
      identifierType: rule.identifier,
      identifierHash,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      retryAfterSeconds: result.retryAfterSeconds
    };
  }
}
