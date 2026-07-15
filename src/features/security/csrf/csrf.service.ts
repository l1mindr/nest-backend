import { ClockService } from '@core/clock/clock.service';
import { TimeConstants } from '@core/clock/time.constants';
import csrfConfig from '@infrastructure/config/security/csrf.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_TOKEN_TTL_MS = 7 * TimeConstants.MS_PER_DAY;

@Injectable()
export class CsrfService {
  constructor(
    @Inject(csrfConfig.KEY)
    private readonly csrfConfiguration: ConfigType<typeof csrfConfig>,
    private readonly clockService: ClockService
  ) {}

  generateToken(sessionId: string): string {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = this.clockService.nowMs() + CSRF_TOKEN_TTL_MS;
    const signature = this.sign(nonce, expiresAt, sessionId);

    return `${nonce}.${expiresAt}.${signature}`;
  }

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

    return this.safeCompare(this.sign(nonce, expiresAt, sessionId), signature);
  }

  private sign(nonce: string, expiresAt: number, sessionId: string): string {
    return createHmac('sha256', this.csrfConfiguration.csrfTokenSecret)
      .update(`${nonce}.${expiresAt}.${sessionId}`)
      .digest('hex');
  }

  private safeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) return false;

    return timingSafeEqual(bufferA, bufferB);
  }
}
