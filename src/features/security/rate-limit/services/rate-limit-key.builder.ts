import { Injectable } from '@nestjs/common';
import { SecurityHasher } from '../../hashing/security-hasher.service';
import {
  RATE_LIMIT_BLOCK_SUFFIX,
  RATE_LIMIT_FINGERPRINT_LENGTH,
  RATE_LIMIT_HASH_LENGTH,
  RATE_LIMIT_KEY_ROOT
} from '../rate-limit.constants';
import { RateLimitRule } from '../types/rate-limit-rule.interface';

@Injectable()
export class RateLimitKeyBuilder {
  constructor(private readonly hasher: SecurityHasher) {}

  /**
   * `rl:{keyPrefix}:{identifier}:{hash}` — for example `rl:login:ip:9f2c…` or
   * `rl:verify:code:41ab…`.
   *
   * The identifier is HMAC'd rather than stored raw. Verification codes carry
   * roughly twenty bits of entropy and email addresses are dictionary
   * guessable, so a plain digest in a Redis dump would be reversible by brute
   * force; keying it with a server-only secret is not.
   */
  counterKey(rule: RateLimitRule, value: string): string {
    return `${RATE_LIMIT_KEY_ROOT}:${rule.keyPrefix}:${rule.identifier}:${this.hash(
      rule,
      value
    )}`;
  }

  blockKey(rule: RateLimitRule, value: string): string {
    return `${this.counterKey(rule, value)}:${RATE_LIMIT_BLOCK_SUFFIX}`;
  }

  /** Log-safe fingerprint: a short prefix of the same HMAC. */
  fingerprint(rule: RateLimitRule, value: string): string {
    return this.hash(rule, value).slice(0, RATE_LIMIT_FINGERPRINT_LENGTH);
  }

  private hash(rule: RateLimitRule, value: string): string {
    // The identifier type is part of the pre-image, so the same string arriving
    // through two dimensions lands in two distinct buckets.
    return this.hasher.hmacHex(
      `${rule.identifier}:${value}`,
      RATE_LIMIT_HASH_LENGTH
    );
  }
}
