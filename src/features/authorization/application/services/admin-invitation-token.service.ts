import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

/** 256 bits — far beyond anything guessable, and short enough to paste. */
const TOKEN_BYTES = 32;

/**
 * Issues and recognises invitation tokens.
 *
 * The token is what proves the invitee was invited, so it is generated from a
 * CSPRNG and never stored: only its SHA-256 digest reaches the database. A
 * plain digest is the right choice here where it would be wrong for a password
 * — 256 random bits leave nothing to brute-force — and it keeps the lookup a
 * single indexed read rather than a scan comparing every row.
 */
@Injectable()
export class AdminInvitationTokenService {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
