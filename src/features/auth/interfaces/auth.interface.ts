import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { ChangePasswordDto } from '@features/users/dto/change-password.dto';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { LoginUserRequestDto } from '../dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';

export interface IAuthService {
  registerUser(dto: RegisterUserRequestDto): Promise<void>;
  loginUser(
    dto: LoginUserRequestDto,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<AuthTokens>;
  changeUserPassword(
    customAuth: CustomAuth,
    changePasswordDto: ChangePasswordDto
  ): Promise<void>;
  refresh(refreshToken: string): Promise<AuthTokens>;
}
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
