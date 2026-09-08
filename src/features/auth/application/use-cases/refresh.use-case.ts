import { ClockService } from '@infrastructure/clock/clock.service';
import {
  ISessionQueryService,
  ISessionRevocationUseCase,
  ISessionRotationUseCase,
  SESSION_QUERY_SERVICE,
  SESSION_REVOCATION_USE_CASE,
  SESSION_ROTATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import {
  ITokenIssueService,
  ITokenVerificationService,
  TOKEN_ISSUE_SERVICE,
  TOKEN_VERIFICATION_SERVICE
} from '@features/token/interfaces/token.interface';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuthTokens, IRefresh } from '../interfaces/auth.interface';
import { RefreshTokenHasher } from '../../infrastructure/providers/refresh-token-hasher.provider';
import { RefreshReplayService } from '../services/refresh-replay.service';

@Injectable()
export class Refresh implements IRefresh {
  constructor(
    @Inject(TOKEN_VERIFICATION_SERVICE)
    private readonly tokenVerificationService: ITokenVerificationService,
    private readonly redisLockService: RedisLockService,
    @Inject(SESSION_QUERY_SERVICE)
    private readonly sessionQueryService: ISessionQueryService,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly clockService: ClockService,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    @Inject(SESSION_ROTATION_USE_CASE)
    private readonly sessionRotationUseCase: ISessionRotationUseCase,
    @Inject(TOKEN_ISSUE_SERVICE)
    private readonly tokenIssueService: ITokenIssueService,
    private readonly refreshReplayService: RefreshReplayService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(Refresh.name);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { sub, sessionId } =
      await this.tokenVerificationService.verifyRefresh(refreshToken);

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

      const presentedHash = this.refreshTokenHasher.hash(refreshToken);

      const isValid = this.refreshTokenHasher.compare(
        refreshToken,
        session.refreshTokenHash
      );

      if (!isValid) {
        // Not the current token — but it may be the one a near-simultaneous
        // request rotated moments ago, which is a race this application
        // creates on purpose (proxy and browser refresh against one cookie
        // jar without shared single-flight state). Only the immediately
        // previous generation, only inside the grace window; anything else
        // returns null and falls through to revocation below.
        const raced = await this.refreshReplayService.find(
          sessionId,
          presentedHash,
          session.version
        );

        if (raced) {
          this.logger.info(
            {
              event: LogEvent.REFRESH_ROTATION_RACED,
              userId: sub,
              sessionId
            },
            'Refresh token rotation race resolved from grace window'
          );

          return raced;
        }

        await this.revocationUseCase.revoke(sub, sessionId);
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      const { now, expiresAt } = this.clockService.snapshot();

      const tokens = await this.tokenIssueService.issuePair(
        sub,
        session.id,
        now,
        expiresAt
      );

      const newRefreshTokenHash = this.refreshTokenHasher.hash(
        tokens.refreshToken
      );

      const ok = await this.sessionRotationUseCase.execute(
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

      // Written only after the rotation has committed, and pinned to the
      // version the consumed token was valid at, so it can serve exactly one
      // generation of racing requests and no older one.
      await this.refreshReplayService.remember(
        sessionId,
        presentedHash,
        session.version,
        tokens
      );

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
