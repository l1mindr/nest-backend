import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class SessionIdResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.SESSION;

  /** Null on public routes, for the same reason as the user dimension. */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return request.session?.id ?? null;
  }
}
