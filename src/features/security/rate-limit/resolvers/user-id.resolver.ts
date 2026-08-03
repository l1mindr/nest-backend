import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class UserIdResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.USER;

  /**
   * Null on public routes, where the JWT guard short-circuits before populating
   * `request.user`. The rule is then skipped and the group's address and device
   * dimensions still gate the request.
   */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return request.user?.id ?? null;
  }
}
