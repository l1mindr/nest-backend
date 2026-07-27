import { ClockService } from '@core/clock/clock.service';
import { TimeConstants } from '@core/clock/time.constants';
import csrfConfig from '@infrastructure/config/security/csrf.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';

export const CSRF_TOKEN_TTL_MS = 7 * TimeConstants.MS_PER_DAY;

@Injectable()
export class CsrfTokenService {
  constructor(
    @Inject(csrfConfig.KEY)
    private readonly csrfConfiguration: ConfigType<typeof csrfConfig>,
    private readonly clockService: ClockService
  ) {}

  issue(sessionId: string): string {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = this.clockService.nowMs() + CSRF_TOKEN_TTL_MS;
    const signature = this.sign(nonce, expiresAt, sessionId);

    return `${nonce}.${expiresAt}.${signature}`;
  }

  sign(nonce: string, expiresAt: number, sessionId: string): string {
    return createHmac('sha256', this.csrfConfiguration.csrfTokenSecret)
      .update(`${nonce}.${expiresAt}.${sessionId}`)
      .digest('hex');
  }
}
