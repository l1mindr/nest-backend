import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from '@features/auth/config/jwt.config';
import { HashingProvider } from '@features/auth/providers/hashing.provider';
import { BcryptProvider } from '@features/auth/providers/bcrypt.provider';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig.asProvider()),
    TypeOrmModule.forFeature([Session])
  ],
  providers: [
    SessionsService,
    {
      provide: HashingProvider,
      useClass: BcryptProvider
    }
  ],
  controllers: [SessionsController],
  exports: [SessionsService]
})
export class SessionsModule {}
