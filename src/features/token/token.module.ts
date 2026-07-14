import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TOKEN_SERVICE } from './interfaces/token.interface';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule, UsersModule, SessionsModule],
  providers: [
    TokenService,
    { provide: TOKEN_SERVICE, useExisting: TokenService }
  ],
  exports: [TOKEN_SERVICE]
})
export class TokenModule {}
