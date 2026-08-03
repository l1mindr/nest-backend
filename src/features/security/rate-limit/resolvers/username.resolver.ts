import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { readBodyString } from '../utils/read-body-string.util';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

const MAX_USERNAME_LENGTH = 64;

@Injectable()
export class UsernameResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.USERNAME;

  resolve({ request }: RateLimitResolutionContext): string | null {
    return readBodyString(request.body, 'username', {
      maxLength: MAX_USERNAME_LENGTH,
      lowercase: true
    });
  }
}
