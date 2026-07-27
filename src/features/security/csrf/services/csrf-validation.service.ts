import { ClockService } from '@core/clock/clock.service';
import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { CsrfTokenService } from './csrf-token.service';

@Injectable()
export class CsrfValidationService {
  constructor(
    private readonly csrfTokenService: CsrfTokenService,
    private readonly clockService: ClockService
  ) {}

  validate(
    cookieToken?: string,
    headerToken?: string,
    sessionId?: string
  ): boolean {
    if (!cookieToken || !headerToken || !sessionId) return false;

    if (!this.safeCompare(cookieToken, headerToken)) return false;

    const parts = cookieToken.split('.');

    if (parts.length !== 3) return false;

    const [nonce, rawExpiresAt, signature] = parts;
    const expiresAt = Number(rawExpiresAt);

    if (!Number.isSafeInteger(expiresAt)) return false;

    if (expiresAt <= this.clockService.nowMs()) return false;

    return this.safeCompare(
      this.csrfTokenService.sign(nonce, expiresAt, sessionId),
      signature
    );
  }

  private safeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) return false;

    return timingSafeEqual(bufferA, bufferB);
  }
}
