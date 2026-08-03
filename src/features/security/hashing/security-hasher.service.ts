import securityConfig from '@infrastructure/config/security/security.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createHmac } from 'crypto';

/** Hex characters kept by default: 32 chars == 128 bits of the digest. */
export const DEFAULT_HASH_LENGTH = 32;

/**
 * Keyed digests for values that must stay unreadable at rest but still act as a
 * stable lookup key — device fingerprints and rate-limit identifiers.
 *
 * A plain digest would not be enough: verification codes carry roughly twenty
 * bits of entropy and email addresses are dictionary-guessable, so anyone
 * holding a Redis dump could reverse `sha256(value)` by brute force. Keying the
 * digest with a server-only secret makes the mapping unreproducible off-host.
 */
@Injectable()
export class SecurityHasher {
  constructor(
    @Inject(securityConfig.KEY)
    private readonly securityConfiguration: ConfigType<typeof securityConfig>
  ) {}

  hmacHex(value: string, length: number = DEFAULT_HASH_LENGTH): string {
    return createHmac('sha256', this.securityConfiguration.hashSecret)
      .update(value)
      .digest('hex')
      .slice(0, length);
  }
}
