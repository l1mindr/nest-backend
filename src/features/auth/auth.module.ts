import { SessionsService } from '@features/sessions/sessions.service';
import { TokenModule } from '@features/token/token.module';
import { UsersService } from '@features/users/users.service';
import { SESSIONS_SERVICE, USERS_SERVICE } from '@infrastructure/di/tokens';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import jwtConfig from './config/jwt.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { BcryptProvider } from './providers/bcrypt.provider';
import { HashingProvider } from './providers/hashing.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [ConfigModule.forFeature(jwtConfig), TokenModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    },
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    { provide: SESSIONS_SERVICE, useClass: SessionsService },
    { provide: USERS_SERVICE, useClass: UsersService }
  ]
})
export class AuthModule {}
