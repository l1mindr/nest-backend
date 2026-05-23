import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    UsersModule,
    SessionsModule
  ],
  providers: [TokenService, JwtStrategy],
  exports: [TokenService]
})
export class TokenModule {}
