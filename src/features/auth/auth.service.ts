import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { SessionsService } from '@features/sessions/sessions.service';
import { TokenService } from '@features/token/token.service';
import { UsersService } from '@features/users/users.service';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
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

  async registerUser(registerUserDto: RegisterUserDto): Promise<void> {
    const password = await this.hashingProvider.hash(registerUserDto.password);

    return this.usersService.register({
      ...registerUserDto,
      password
    });
  }

  async loginUser(
    { email, password }: LoginUserDto,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<AuthTokens> {
    const user = await this.usersService.findByIdentifierForAuth(email);

    if (!user) throw new UnauthorizedException('invalid credentials');

    const isMatch = await this.hashingProvider.compare(password, user.password);

    if (!isMatch) throw new UnauthorizedException('invalid credentials');

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
    { currentPassword, newPassword }: ChangePasswordDto
  ): Promise<void> {
    const userWithPassword = await this.usersService.findByIdWithPassword(
      user.id
    );

    if (!userWithPassword) throw new UnauthorizedException('invalid token');

    // Verify current password
    const isMatch = await this.hashingProvider.compare(
      currentPassword,
      userWithPassword.password
    );

    if (!isMatch) throw new BadRequestException('invalid current password');

    // Check new password is different
    const isSame = await this.hashingProvider.compare(
      newPassword,
      userWithPassword.password
    );

    if (isSame) throw new BadRequestException('new password must be different');

    // Hash new password and update
    const password = await this.hashingProvider.hash(newPassword);
    await this.usersService.setPassword(user.id, password);
    await this.sessionsService.terminateOthers(user, session.refreshTokenHash);
  }

  async refresh(refreshToken: string) {
    const { sub, sessionId } =
      await this.tokenService.verifyRefreshToken(refreshToken);

    const session = await this.sessionsService.getActive(sub, sessionId);

    if (!session) throw new UnauthorizedException('session expired');

    const isValidRefreshToken = await this.hashingProvider.compare(
      refreshToken,
      session.refreshTokenHash
    );

    if (!isValidRefreshToken) {
      await this.sessionsService.updateRefreshState(session, {
        isRevoked: true
      });

      throw new UnauthorizedException('refresh token reuse detected');
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
