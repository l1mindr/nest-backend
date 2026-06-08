import { DeviceModule } from '@core/device/device.module';
import { SessionsModule } from '@features/sessions/sessions.module';
import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BcryptProvider } from './providers/bcrypt.provider';
import { HashingProvider } from './providers/hashing.provider';

@Module({
  imports: [UsersModule, SessionsModule, TokenModule, DeviceModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    }
  ]
})
export class AuthModule {}
