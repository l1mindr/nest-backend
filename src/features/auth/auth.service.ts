import {
  ISessionsService,
  IssuedTokens
} from '@features/sessions/interfaces/sessions.interface';
import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { IUsersService } from '@features/users/interfaces/users.interface';
import { SESSIONS_SERVICE, USERS_SERVICE } from '@infrastructure/di/tokens';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { IAuthService } from './interfaces/auth.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { HashingProvider } from './providers/hashing.provider';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(SESSIONS_SERVICE)
    private readonly sessionsService: ISessionsService,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService
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
  ): Promise<IssuedTokens> {
    const user = await this.usersService.findByIdentifierForAuth(email);

    if (!user) throw new UnauthorizedException('invalid credentials');

    const isMatch = await this.hashingProvider.compare(password, user.password);

    if (!isMatch) throw new UnauthorizedException('invalid credentials');

    return await this.sessionsService.issue(user.id, ipAddress, userAgent);
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

  async validateUserJwt({ sub, sessionId }: JwtPayload): Promise<CustomAuth> {
    const user = await this.usersService.findByIdForSessionValidation(sub);

    if (!user) throw new UnauthorizedException('invalid token');

    const session = await this.sessionsService.getActive(user.id, sessionId);

    if (!session) throw new UnauthorizedException('session expired');

    return { user, session };
  }

  async refreshSession(refreshToken: string) {
    return this.sessionsService.refresh(refreshToken);
  }
}
