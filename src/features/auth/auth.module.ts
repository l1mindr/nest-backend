import { CsrfModule } from '@features/security/csrf/csrf.module';
import { DeviceDetectionModule } from '@features/security/device-detection/device-detection.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './../users/users.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthCookieService } from './application/services/auth-cookie.service';
import { ChangePassword } from './application/use-cases/change-password.use-case';
import { Login } from './application/use-cases/login.use-case';
import { Refresh } from './application/use-cases/refresh.use-case';
import { Register } from './application/use-cases/register.use-case';
import {
  CHANGE_PASSWORD,
  LOGIN,
  REFRESH,
  REGISTER
} from './application/interfaces/auth.interface';
import { BcryptProvider } from './infrastructure/providers/bcrypt.provider';
import { HashingProvider } from './infrastructure/providers/hashing.provider';
import { RefreshTokenHasher } from './infrastructure/providers/refresh-token-hasher.provider';

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
    Register,
    { provide: REGISTER, useExisting: Register },
    Login,
    { provide: LOGIN, useExisting: Login },
    ChangePassword,
    { provide: CHANGE_PASSWORD, useExisting: ChangePassword },
    Refresh,
    { provide: REFRESH, useExisting: Refresh },
    AuthCookieService,
    RefreshTokenHasher,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    }
  ]
})
export class AuthModule {}
