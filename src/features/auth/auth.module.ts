import { CsrfModule } from '@features/security/csrf/csrf.module';
import { DeviceDetectionModule } from '@features/security/device-detection/device-detection.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_SERVICE } from './interfaces/auth.interface';
import { BcryptProvider } from './providers/bcrypt.provider';
import { HashingProvider } from './providers/hashing.provider';
import { RefreshTokenHasher } from './providers/refresh-token-hasher.provider';

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
    AuthService,
    { provide: AUTH_SERVICE, useExisting: AuthService },
    RefreshTokenHasher,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    }
  ]
})
export class AuthModule {}
