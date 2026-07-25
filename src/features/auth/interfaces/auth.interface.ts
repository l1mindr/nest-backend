import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { ChangePasswordRequestDto } from '../dto/request/change-password.request.dto';
import { LoginUserRequestDto } from '../dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export const REGISTER_USER_SERVICE = Symbol('IRegisterUserService');

export interface IRegisterUserService {
  registerUser(dto: RegisterUserRequestDto): Promise<void>;
}

export const LOGIN_USER_SERVICE = Symbol('ILoginUserService');

export interface ILoginUserService {
  loginUser(
    dto: LoginUserRequestDto,
    ipAddress: string,
    device: DeviceContext
  ): Promise<AuthTokens>;
}

export const CHANGE_PASSWORD_SERVICE = Symbol('IChangePasswordService');

export interface IChangePasswordService {
  changeUserPassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordRequestDto
  ): Promise<void>;
}

export const REFRESH_TOKEN_SERVICE = Symbol('IRefreshTokenService');

export interface IRefreshTokenService {
  refreshTokens(refreshToken: string): Promise<AuthTokens>;
}
