import { ClockService } from '@core/clock/clock.service';
import {
  ISessionQueryService,
  ISessionRevocationService,
  ISessionRotationService,
  SESSION_QUERY_SERVICE,
  SESSION_REVOCATION_SERVICE,
  SESSION_ROTATION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import {
  ITokenService,
  TOKEN_SERVICE
} from '@features/token/interfaces/token.interface';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuthTokens, IRefresh } from '../../interfaces/auth.interface';
import { RefreshTokenHasher } from '../../providers/refresh-token-hasher.provider';

@Injectable()
export class Refresh implements IRefresh {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    private readonly redisLockService: RedisLockService,
    @Inject(SESSION_QUERY_SERVICE)
    private readonly sessionQueryService: ISessionQueryService,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly clockService: ClockService,
    @Inject(SESSION_REVOCATION_SERVICE)
    private readonly revocationService: ISessionRevocationService,
    @Inject(SESSION_ROTATION_SERVICE)
    private readonly sessionRotationService: ISessionRotationService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(Refresh.name);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { sub, sessionId } =
      await this.tokenService.verifyRefreshToken(refreshToken);

    const lockToken = await this.redisLockService.acquire(
      RedisKey.REFRESH_LOCK,
      sessionId
    );

    if (!lockToken) {
      throw SessionErrors.refreshRateLimited(sessionId);
    }

    try {
      const session = await this.sessionQueryService.findActive(sub, sessionId);

      if (!session) {
        throw SessionErrors.sessionExpired();
      }

      const isValid = this.refreshTokenHasher.compare(
        refreshToken,
        session.refreshTokenHash
      );

      if (!isValid) {
        await this.revocationService.revoke(sub, sessionId);
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      const { now, expiresAt } = this.clockService.snapshot();

      const tokens = await this.tokenService.issuePair(
        sub,
        session.id,
        now,
        expiresAt
      );

      const newRefreshTokenHash = this.refreshTokenHasher.hash(
        tokens.refreshToken
      );

      const ok = await this.sessionRotationService.rotate(
        session.id,
        session.version,
        session.refreshTokenHash,
        newRefreshTokenHash,
        {
          now,
          expiresAt
        }
      );

      if (!ok) {
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      this.logger.info(
        { event: LogEvent.REFRESH_ROTATED, userId: sub, sessionId },
        'Refresh token rotated'
      );

      return tokens;
    } finally {
      await this.redisLockService.release(
        RedisKey.REFRESH_LOCK,
        sessionId,
        lockToken
      );
    }
  }
}
