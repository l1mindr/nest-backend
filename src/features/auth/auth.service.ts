import { ClockService } from '@core/clock/clock.service';
import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import {
  ISessionsService,
  SESSION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { TokenErrors } from '@features/token/errors/token-errors';
import {
  ITokenService,
  TOKEN_SERVICE
} from '@features/token/interfaces/token.interface';
import {
  IUsersService,
  USER_SERVICE
} from '@features/users/interfaces/users.interface';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { ChangePasswordRequestDto } from './dto/request/change-password.request.dto';
import { LoginUserRequestDto } from './dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { AuthErrors } from './errors/auth-errors';
import { AuthTokens, IAuthService } from './interfaces/auth.interface';
import { HashingProvider } from './providers/hashing.provider';
import { RefreshTokenHasher } from './providers/refresh-token-hasher.provider';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly deviceMapper: DeviceMapper,
    private readonly clockService: ClockService,
    private readonly hashingProvider: HashingProvider,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(SESSION_SERVICE)
    private readonly sessionsService: ISessionsService,
    @Inject(USER_SERVICE)
    private readonly usersService: IUsersService,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    private readonly redisLockService: RedisLockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(AuthService.name);
  }

  async registerUser(dto: RegisterUserRequestDto): Promise<void> {
    const password = await this.hashingProvider.hash(dto.password);

    return this.usersService.register({
      ...dto,
      password
    });
  }

  async loginUser(
    { email, password }: LoginUserRequestDto,
    ipAddress: string,
    device: DeviceContext
  ): Promise<AuthTokens> {
    const user = await this.usersService.findByIdentifierForAuth(email);

    if (!user) throw AuthErrors.invalidCredentials();

    const isMatch = await this.hashingProvider.compare(password, user.password);

    if (!isMatch) throw AuthErrors.invalidCredentials();

    const { now, expiresAt } = this.clockService.snapshot();
    const userAgent = this.deviceMapper.toSessionUserAgent(device);

    const session = await this.sessionsService.issue(
      user.id,
      ipAddress,
      userAgent,
      expiresAt
    );

    const { accessToken, refreshToken } = await this.tokenService.issuePair(
      user.id,
      session.id,
      now,
      expiresAt
    );

    const refreshTokenHash = this.refreshTokenHasher.hash(refreshToken);

    await this.sessionsService.updateRefreshState(session, {
      refreshTokenHash,
      lastUsedAt: new Date(now)
    });

    this.logger.info(
      {
        event: LogEvent.LOGIN_SUCCESS,
        userId: user.id,
        sessionId: session.id,
        ip: ipAddress
      },
      'User logged in'
    );

    return { accessToken, refreshToken };
  }

  async changeUserPassword(
    userId: string,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordRequestDto
  ): Promise<void> {
    const userWithPassword =
      await this.usersService.findByIdWithPassword(userId);

    if (!userWithPassword) throw TokenErrors.invalidToken();

    // Verify current password
    const isMatch = await this.hashingProvider.compare(
      currentPassword,
      userWithPassword.password
    );

    if (!isMatch) throw AuthErrors.invalidCurrentPassword();

    // Check new password is different
    const isSame = await this.hashingProvider.compare(
      newPassword,
      userWithPassword.password
    );

    if (isSame) throw AuthErrors.passwordMustBeDifferent();

    const password = await this.hashingProvider.hash(newPassword);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.usersService.setPassword(userId, password, manager);
        await this.sessionsService.terminateOthers(userId, sessionId, manager);
      });
    } catch (error) {
      this.logger.error(
        { event: LogEvent.PASSWORD_CHANGED, userId, sessionId, err: error },
        'Password change transaction failed'
      );
      throw AuthErrors.passwordChangeFailed();
    }

    this.logger.info(
      { event: LogEvent.PASSWORD_CHANGED, userId, sessionId },
      'User changed password'
    );
  }

  async refresh(refreshToken: string) {
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
      const session = await this.sessionsService.getActive(sub, sessionId);

      if (!session) {
        throw SessionErrors.sessionExpired();
      }

      // The stored refresh-token hash is the single source of truth for
      // replay detection. Once a token is rotated the old token no longer
      // matches the stored hash, so reusing it fails here. We do NOT compare
      // the JWT `iat` (second precision) against `rotatedAt` (millisecond
      // precision) because a freshly issued token can look reused within the
      // same second.
      const isValid = this.refreshTokenHasher.compare(
        refreshToken,
        session.refreshTokenHash
      );

      if (!isValid) {
        await this.sessionsService.revoke(sub, sessionId);
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

      const ok = await this.sessionsService.rotateAtomic(
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
