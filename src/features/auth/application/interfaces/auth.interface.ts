import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { ChangePasswordRequestDto } from '../../presentation/dto/request/change-password.request.dto';
import { LoginUserRequestDto } from '../../presentation/dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../../presentation/dto/request/register-user.request.dto';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export const REGISTER = Symbol('IRegister');

export interface IRegister {
  register(dto: RegisterUserRequestDto): Promise<void>;
}

export const LOGIN = Symbol('ILogin');

export interface ILogin {
  login(
    dto: LoginUserRequestDto,
    ipAddress: string,
    device: DeviceContext
  ): Promise<AuthTokens>;
}

export const CHANGE_PASSWORD = Symbol('IChangePassword');

export interface IChangePassword {
  changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordRequestDto
  ): Promise<void>;
}

export const REFRESH = Symbol('IRefresh');

export interface IRefresh {
  refresh(refreshToken: string): Promise<AuthTokens>;
}
