import { BcryptProvider } from '@features/auth/providers/bcrypt.provider';
import { HashingProvider } from '@features/auth/providers/hashing.provider';
import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), TokenModule],
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
