import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SESSION_SERVICE } from './interfaces/sessions.interface';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [
    SessionsService,
    { provide: SESSION_SERVICE, useExisting: SessionsService }
  ],
  controllers: [SessionsController],
  exports: [SESSION_SERVICE]
})
export class SessionsModule {}
