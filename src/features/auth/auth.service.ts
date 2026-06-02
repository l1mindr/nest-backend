import { SessionErrors } from '@features/sessions/errors/session-errors';
import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { SessionsService } from '@features/sessions/sessions.service';
import { TokenErrors } from '@features/token/errors/token-errors';
import { TokenService } from '@features/token/token.service';
import { UsersService } from '@features/users/users.service';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
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
    private readonly hashingProvider: HashingProvider,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService
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
    userAgent: IUserAgent
  ): Promise<AuthTokens> {
    const user = await this.usersService.findByIdentifierForAuth(email);

    if (!user) throw AuthErrors.invalidCredentials();

    const isMatch = await this.hashingProvider.compare(password, user.password);

    if (!isMatch) throw AuthErrors.invalidCredentials();

    const now = Date.now();
    const expiresAt = this.tokenService.createExpirationDate(now);

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
      refreshTokenHash
    });

    return { accessToken, refreshToken };
  }

  async changeUserPassword(
    { user, session }: CustomAuth,
    { currentPassword, newPassword }: ChangePasswordRequestDto
  ): Promise<void> {
    const userWithPassword = await this.usersService.findByIdWithPassword(
      user.id
    );

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
    await this.usersService.setPassword(user.id, password);
    await this.sessionsService.terminateOthers(user, session.id);
  }

  async refresh(refreshToken: string) {
    const { sub, sessionId } =
      await this.tokenService.verifyRefreshToken(refreshToken);

    const session = await this.sessionsService.getActive(sub, sessionId);

    if (!session) throw SessionErrors.sessionExpired();

    const isValidRefreshToken = await this.hashingProvider.compare(
      refreshToken,
      session.refreshTokenHash
    );

    if (!isValidRefreshToken) {
      await this.sessionsService.updateRefreshState(session, {
        isRevoked: true
      });
      throw SessionErrors.sessionReuseDetected(sessionId);
    }

    const now = Date.now();
    const expiresAt = this.tokenService.createExpirationDate(now);

    const tokens = await this.tokenService.issuePair(
      session.owner.id,
      session.id,
      now,
      expiresAt
    );

    const refreshTokenHash = await this.hashingProvider.hash(refreshToken);

    await this.sessionsService.updateRefreshState(session, {
      refreshTokenHash,
      lastUsedAt: new Date(),
      expiresAt
    });

    return { ...tokens };
  }
}
