import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class RouteResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.ROUTE;

  /**
   * A global budget for one handler, independent of who is calling. The route
   * key is derived from the controller and handler names, so it carries no
   * query string and cannot be varied by the client.
   */
  resolve({ routeKey }: RateLimitResolutionContext): string | null {
    return routeKey;
  }
}
