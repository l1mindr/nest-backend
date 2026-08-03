import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { readBodyString } from '../utils/read-body-string.util';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

/** RFC 5321 caps a forward path at 320 characters. */
const MAX_EMAIL_LENGTH = 320;

@Injectable()
export class EmailResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.EMAIL;

  /**
   * Lower-cased to match the `@TrimLowercase()` normalisation the validation
   * pipe applies further down the request, so the bucket the guard counts
   * against and the row eventually persisted agree on one spelling of the
   * address.
   */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return readBodyString(request.body, 'email', {
      maxLength: MAX_EMAIL_LENGTH,
      lowercase: true
    });
  }
}
