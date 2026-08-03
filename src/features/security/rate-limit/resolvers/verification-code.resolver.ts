import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { readBodyString } from '../utils/read-body-string.util';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

const MAX_CODE_LENGTH = 16;

@Injectable()
export class VerificationCodeResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.VERIFICATION_CODE;

  /**
   * Deliberately not case-folded. Codes are digits today, and folding case
   * would silently merge distinct codes into one bucket should the format ever
   * gain letters.
   */
  resolve({ request }: RateLimitResolutionContext): string | null {
    return readBodyString(request.body, 'code', {
      maxLength: MAX_CODE_LENGTH
    });
  }
}
