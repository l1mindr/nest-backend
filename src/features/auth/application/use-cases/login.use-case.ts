import { ClockService } from '@infrastructure/clock/clock.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import {
  ISessionIssueUseCase,
  ISessionRotationUseCase,
  SESSION_ISSUE_USE_CASE,
  SESSION_ROTATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import {
  ITokenIssueService,
  TOKEN_ISSUE_SERVICE
} from '@features/token/interfaces/token.interface';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import {
  IResendVerificationUseCase,
  IUserQueryService,
  IUserRepository,
  RESEND_VERIFICATION_USE_CASE,
  USER_QUERY_SERVICE,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { RateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import {
  IRateLimitService,
  RATE_LIMIT_SERVICE
} from '@features/security/rate-limit/services/rate-limit.service';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoginUserRequestDto } from '../../presentation/dto/request/login-user.request.dto';
import { AuthErrors } from '../../domain/errors/auth-errors';
import { AuthTokens, ILogin } from '../interfaces/auth.interface';
import { HashingProvider } from '../../infrastructure/providers/hashing.provider';
import { RefreshTokenHasher } from '../../infrastructure/providers/refresh-token-hasher.provider';

@Injectable()
export class Login implements ILogin {
  constructor(
    private readonly deviceMapper: DeviceMapper,
    private readonly clockService: ClockService,
    private readonly hashingProvider: HashingProvider,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(SESSION_ISSUE_USE_CASE)
    private readonly sessionIssueUseCase: ISessionIssueUseCase,
    @Inject(TOKEN_ISSUE_SERVICE)
    private readonly tokenIssueService: ITokenIssueService,
    @Inject(USER_QUERY_SERVICE)
    private readonly userQueryService: IUserQueryService,
    @Inject(SESSION_ROTATION_USE_CASE)
    private readonly sessionRotationUseCase: ISessionRotationUseCase,
    @Inject(RESEND_VERIFICATION_USE_CASE)
    private readonly resendVerificationUseCase: IResendVerificationUseCase,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimitService: IRateLimitService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(Login.name);
  }

  async login(
    { email, password }: LoginUserRequestDto,
    ipAddress: string,
    device: DeviceContext
  ): Promise<AuthTokens> {
    const user = await this.userQueryService.findByEmailOrUsername(email);

    if (!user) throw AuthErrors.invalidCredentials();

    const isMatch = await this.hashingProvider.compare(password, user.password);

    if (!isMatch) throw AuthErrors.invalidCredentials();

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      const createdAt = user.registryDates.createdAt;
      const now = this.clockService.nowDate();
      const windowExpired =
        now.getTime() - createdAt.getTime() >= TimeConstants.MS_PER_DAY;

      if (windowExpired) {
        await this.userRepository.updateStatus(user.id, UserStatus.DEACTIVATE);
        throw AuthErrors.invalidCredentials();
      }

      await this.resendVerificationUseCase.execute(user.email);
      throw AuthErrors.accountNotVerified();
    }

    if (user.status !== UserStatus.ACTIVATE) {
      throw AuthErrors.invalidCredentials();
    }

    // Automatic bcrypt → Argon2id migration
    // If the user authenticated successfully with a legacy bcrypt hash,
    // migrate it to Argon2id for future logins. This happens asynchronously
    // and does not block the login flow.
    if (this.hashingProvider.needsMigration(user.password)) {
      this.migrateBcryptToArgon2id(user.id, password, user.password);
    }

    const { now, expiresAt } = this.clockService.snapshot();
    const userAgent = this.deviceMapper.toSessionUserAgent(device);

    const session = await this.sessionIssueUseCase.execute(
      user.id,
      ipAddress,
      userAgent,
      expiresAt
    );

    const { accessToken, refreshToken } =
      await this.tokenIssueService.issuePair(
        user.id,
        session.id,
        now,
        expiresAt
      );

    const refreshTokenHash = this.refreshTokenHasher.hash(refreshToken);

    session.refreshTokenHash = refreshTokenHash;
    await this.sessionRotationUseCase.saveHash(session);

    // Only failures should count toward the per-address lockout, otherwise a
    // user who signs in regularly from one address would eventually lock
    // themselves out. The identifier must match what the guard's email resolver
    // produced for this request.
    await this.rateLimitService.reset(
      RateLimitPolicies.Auth.Login.Email,
      email.trim().toLowerCase()
    );

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

  /**
   * Migrates a bcrypt hash to Argon2id asynchronously.
   *
   * This happens in the background after authentication succeeds. If migration
   * fails, the login still completes successfully — the bcrypt hash is retained
   * and migration will be retried on the next login.
   *
   * Uses conditional update to prevent race conditions where concurrent logins
   * might overwrite a newer password hash.
   */
  private migrateBcryptToArgon2id(
    userId: string,
    plainPassword: string,
    currentBcryptHash: string
  ): void {
    // Fire and forget - do not await
    this.hashingProvider
      .hash(plainPassword)
      .then((argon2Hash) =>
        this.userRepository.updatePasswordHashConditional(
          userId,
          argon2Hash,
          currentBcryptHash
        )
      )
      .then((updated) => {
        if (updated) {
          this.logger.info(
            {
              event: LogEvent.PASSWORD_MIGRATED,
              userId
            },
            'Password migrated from bcrypt to Argon2id'
          );
        } else {
          this.logger.debug(
            {
              event: LogEvent.PASSWORD_MIGRATION_SKIPPED,
              userId,
              reason: 'Hash already changed'
            },
            'Password migration skipped - hash was updated by another request'
          );
        }
      })
      .catch((error: unknown) => {
        // Migration failure does not break successful login
        this.logger.warn(
          {
            event: LogEvent.PASSWORD_MIGRATION_FAILED,
            userId,
            err: error
          },
          'Failed to migrate password from bcrypt to Argon2id - will retry on next login'
        );
      });
  }
}
