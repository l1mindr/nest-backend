import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { ChangePasswordRequestDto } from '../dto/request/change-password.request.dto';
import { LoginUserRequestDto } from '../dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';

export interface IAuthService {
  registerUser(dto: RegisterUserRequestDto): Promise<void>;
  loginUser(
    dto: LoginUserRequestDto,
    ipAddress: string,
    device: DeviceContext
  ): Promise<AuthTokens>;
  changeUserPassword(
    userId: string,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordRequestDto
  ): Promise<void>;
  refresh(refreshToken: string): Promise<AuthTokens>;
}
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
