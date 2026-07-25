import { CsrfModule } from '@features/security/csrf/csrf.module';
import { DeviceDetectionModule } from '@features/security/device-detection/device-detection.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './../users/users.module';
import { AuthController } from './auth.controller';
import {
  CHANGE_PASSWORD_SERVICE,
  LOGIN_USER_SERVICE,
  REFRESH_TOKEN_SERVICE,
  REGISTER_USER_SERVICE
} from './interfaces/auth.interface';
import { BcryptProvider } from './providers/bcrypt.provider';
import { HashingProvider } from './providers/hashing.provider';
import { RefreshTokenHasher } from './providers/refresh-token-hasher.provider';
import { ChangePasswordService } from './services/change-password.service';
import { LoginUserService } from './services/login-user.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { RegisterUserService } from './services/register-user.service';

@Module({
  imports: [
    UsersModule,
    SessionsModule,
    TokenModule,
    DeviceDetectionModule,
    CsrfModule
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserService,
    { provide: REGISTER_USER_SERVICE, useExisting: RegisterUserService },
    LoginUserService,
    { provide: LOGIN_USER_SERVICE, useExisting: LoginUserService },
    ChangePasswordService,
    { provide: CHANGE_PASSWORD_SERVICE, useExisting: ChangePasswordService },
    RefreshTokenService,
    { provide: REFRESH_TOKEN_SERVICE, useExisting: RefreshTokenService },
    RefreshTokenHasher,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    }
  ]
})
export class AuthModule {}
