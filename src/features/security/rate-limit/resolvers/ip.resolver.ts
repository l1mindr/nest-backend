import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class IpResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.IP;

  /**
   * `request.ip` honours Express' `trust proxy` setting, so behind the expected
   * single proxy hop this is the client address rather than the proxy's.
   */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return request.ip ?? null;
  }
}
