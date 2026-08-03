import { TimeConstants } from '@infrastructure/clock/time.constants';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { SecurityErrors } from '../../errors/security-errors';
import { RATE_LIMIT_KEY, RateLimitHeader } from '../rate-limit.constants';
import { RateLimitEvaluatorService } from '../services/rate-limit-evaluator.service';
import { RateLimitDecision } from '../types/rate-limit-result.interface';
import { RateLimitMetadata } from '../types/rate-limit-rule.interface';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly evaluator: RateLimitEvaluatorService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<RateLimitMetadata>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!metadata?.rules.length) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const decision = await this.evaluator.evaluate(
      request,
      this.toRouteKey(context),
      metadata.rules
    );

    // Set on denials too, so a rejected caller still learns what the budget was.
    this.applyHeaders(response, decision);

    if (!decision.allowed) {
      throw SecurityErrors.rateLimitExceeded(decision.retryAfterSeconds);
    }

    return true;
  }

  /**
   * Identifies the handler rather than the request path.
   *
   * The previous implementation fell back to `request.url`, which carries the
   * query string — appending `?x=1` minted a fresh bucket. Controller and
   * handler names cannot be influenced by the caller and are stable across API
   * versions.
   */
  private toRouteKey(context: ExecutionContext): string {
    return `${context.getClass().name}.${context.getHandler().name}`;
  }

  private applyHeaders(response: Response, decision: RateLimitDecision): void {
    const { result } = decision;

    // Nothing to advertise when every rule was skipped.
    if (!result) return;

    response.setHeader(RateLimitHeader.LIMIT, String(result.limit));
    response.setHeader(RateLimitHeader.REMAINING, String(result.remaining));
    response.setHeader(
      RateLimitHeader.RESET,
      String(Math.ceil(result.resetAt / TimeConstants.MS_PER_SECOND))
    );
  }
}
