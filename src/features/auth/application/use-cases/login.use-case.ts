import { ClockService } from '@core/clock/clock.service';
import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { DeviceMapper } from '@features/security/device-detection/mappers/device.mapper';
import {
  ISessionIssueService,
  ISessionRotationService,
  SESSION_ISSUE_SERVICE,
  SESSION_ROTATION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import {
  ITokenIssueService,
  TOKEN_ISSUE_SERVICE
} from '@features/token/interfaces/token.interface';
import { UserStatus } from '@features/users/enums/user-status.enum';
import {
  IUserQueryService,
  USER_QUERY_SERVICE
} from '@features/users/interfaces/users.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoginUserRequestDto } from '../../dto/request/login-user.request.dto';
import { AuthErrors } from '../../errors/auth-errors';
import { AuthTokens, ILogin } from '../../interfaces/auth.interface';
import { HashingProvider } from '../../providers/hashing.provider';
import { RefreshTokenHasher } from '../../providers/refresh-token-hasher.provider';

@Injectable()
export class Login implements ILogin {
  constructor(
    private readonly deviceMapper: DeviceMapper,
    private readonly clockService: ClockService,
    private readonly hashingProvider: HashingProvider,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(SESSION_ISSUE_SERVICE)
    private readonly sessionIssueService: ISessionIssueService,
    @Inject(TOKEN_ISSUE_SERVICE)
    private readonly tokenIssueService: ITokenIssueService,
    @Inject(USER_QUERY_SERVICE)
    private readonly userQueryService: IUserQueryService,
    @Inject(SESSION_ROTATION_SERVICE)
    private readonly sessionRotationService: ISessionRotationService,
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

    if (user.status !== UserStatus.ACTIVATE) {
      throw AuthErrors.invalidCredentials();
    }

    const { now, expiresAt } = this.clockService.snapshot();
    const userAgent = this.deviceMapper.toSessionUserAgent(device);

    const session = await this.sessionIssueService.issue(
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
    await this.sessionRotationService.saveHash(session);

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
}
