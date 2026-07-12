import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule, UsersModule, SessionsModule],
  providers: [TokenService],
  exports: [TokenService]
})
export class TokenModule {}
