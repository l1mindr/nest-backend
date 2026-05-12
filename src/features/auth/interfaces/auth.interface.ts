import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { ChangePasswordDto } from '@features/users/dto/change-password.dto';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { JwtPayload } from './jwt-payload.interface';

export interface IAuthService {
  registerUser(registerUserDto: RegisterUserDto): Promise<void>;
  loginUser(
    loginUserDto: LoginUserDto,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<IAuthTokens>;
  changeUserPassword(
    customAuth: CustomAuth,
    changePasswordDto: ChangePasswordDto
  ): Promise<void>;
  validateUserJwt(jwtPayload: JwtPayload): Promise<CustomAuth>;
  refreshSession(refreshToken: string): Promise<IAuthTokens>;
}
export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}
