import jwtConfig from '@features/auth/config/jwt.config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.registerAsync(jwtConfig.asProvider())],
  providers: [TokenService],
  exports: [TokenService]
})
export class TokenModule {}
