import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService]
})
export class SessionsModule {}
