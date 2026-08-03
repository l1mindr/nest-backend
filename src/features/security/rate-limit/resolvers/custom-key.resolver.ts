import { Injectable } from '@nestjs/common';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import { RateLimitResolutionContext } from '../types/rate-limit-rule.interface';
import { IRateLimitIdentifierResolver } from './rate-limit-resolver.interface';

@Injectable()
export class CustomKeyResolver implements IRateLimitIdentifierResolver {
  readonly type = RateLimitIdentifier.CUSTOM;

  /**
   * Delegates to the rule's own generator, which lets a caller combine
   * dimensions (a code scoped to an address, say) without adding a member to
   * the identifier enum. The config spec asserts every custom rule carries one.
   */
  resolve(context: RateLimitResolutionContext): string | null {
    return context.rule.keyGenerator?.(context) ?? null;
  }
}
