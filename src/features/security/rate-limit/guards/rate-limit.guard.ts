import { SecurityErrors } from '@features/security/errors/security-errors';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions
} from '../decorators/rate-limit.decorator';
import { RateLimitService } from '../rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const ip = request.ip;

    const route = request.route?.path ?? request.url;

    const allowed = await this.rateLimitService.consume(
      route,
      ip,
      options.limit,
      options.ttl
    );

    if (!allowed) {
      throw SecurityErrors.rateLimitExceeded();
    }

    return true;
  }
}
