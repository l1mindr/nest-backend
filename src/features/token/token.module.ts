import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig.asProvider()),
    UsersModule,
    SessionsModule
  ],
  providers: [TokenService],
  exports: [TokenService]
})
export class TokenModule {}
