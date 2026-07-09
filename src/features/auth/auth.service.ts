import { ClockService } from '@core/clock/clock.service';
import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { SessionsService } from '@features/sessions/sessions.service';
import { TokenErrors } from '@features/token/errors/token-errors';
import { TokenService } from '@features/token/token.service';
import { UsersService } from '@features/users/users.service';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { Injectable } from '@nestjs/common';
import { ChangePasswordRequestDto } from './dto/request/change-password.request.dto';
import { LoginUserRequestDto } from './dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { AuthErrors } from './errors/auth-errors';
import { AuthTokens, IAuthService } from './interfaces/auth.interface';
import { HashingProvider } from './providers/hashing.provider';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly deviceMapper: DeviceMapper,
    private readonly clockService: ClockService,
    private readonly hashingProvider: HashingProvider,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly redisLockService: RedisLockService
  ) {}

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

    const refreshTokenHash = await this.hashingProvider.hash(refreshToken);

    await this.sessionsService.updateRefreshState(session, {
      refreshTokenHash,
      lastUsedAt: new Date(now)
    });

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

    // Hash new password and update
    const password = await this.hashingProvider.hash(newPassword);
    await this.usersService.setPassword(userId, password);
    await this.sessionsService.terminateOthers(userId, sessionId);
  }

  async refresh(refreshToken: string) {
    const { sub, sessionId, iat } =
      await this.tokenService.verifyRefreshToken(refreshToken);

    const lock = await this.redisLockService.acquire(
      RedisKey.REFRESH_LOCK,
      sessionId
    );

    if (!lock) {
      throw SessionErrors.refreshRateLimited(sessionId);
    }

    try {
      const session = await this.sessionsService.getActive(sub, sessionId);

      if (!session) {
        throw SessionErrors.sessionExpired();
      }

      const isValid = await this.hashingProvider.compare(
        refreshToken,
        session.refreshTokenHash
      );

      if (!isValid) {
        await this.sessionsService.revoke(sub, sessionId);
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      if (session.rotatedAt && session.rotatedAt.getTime() >= iat * 1000) {
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      const { now, expiresAt } = this.clockService.snapshot();

      const tokens = await this.tokenService.issuePair(
        sub,
        session.id,
        now,
        expiresAt
      );

      const newHash = await this.hashingProvider.hash(tokens.refreshToken);

      const ok = await this.sessionsService.rotateAtomic(
        session.id,
        session.version,
        session.refreshTokenHash,
        newHash,
        {
          now,
          expiresAt
        }
      );

      if (!ok) {
        throw SessionErrors.sessionReuseDetected(sessionId);
      }

      return tokens;
    } finally {
      await this.redisLockService.release(RedisKey.REFRESH_LOCK, sessionId);
    }
  }
}
