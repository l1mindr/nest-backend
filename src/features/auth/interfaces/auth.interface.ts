import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { ChangePasswordDto } from '@features/users/dto/change-password.dto';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterUserDto } from '../dto/register-user.dto';

export interface IAuthService {
  registerUser(registerUserDto: RegisterUserDto): Promise<void>;
  loginUser(
    loginUserDto: LoginUserDto,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<AuthTokens>;
  changeUserPassword(
    customAuth: CustomAuth,
    changePasswordDto: ChangePasswordDto
  ): Promise<void>;
  validateUserJwt(email: string, token: string): Promise<CustomAuth>;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
