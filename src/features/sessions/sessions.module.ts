import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionCursorService } from './application/services/session-cursor.service';
import { SessionQueryService } from './application/services/session-query.service';
import { SessionListService } from './application/services/session-list.service';
import { SessionMapper } from './application/mappers/session.mapper';
import { SessionIssueUseCase } from './application/use-cases/session-issue.use-case';
import { SessionRevocationUseCase } from './application/use-cases/session-revocation.use-case';
import { SessionRotationUseCase } from './application/use-cases/session-rotation.use-case';
import { Session } from './entities/session.entity';
import {
  SESSION_CURSOR_SERVICE,
  SESSION_ISSUE_USE_CASE,
  SESSION_LIST_SERVICE,
  SESSION_QUERY_SERVICE,
  SESSION_REPOSITORY,
  SESSION_REVOCATION_USE_CASE,
  SESSION_ROTATION_USE_CASE
} from './interfaces/sessions.interface';
import { SessionRepository } from './repositories/session.repository';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [
    SessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: SessionRepository },
    SessionCursorService,
    { provide: SESSION_CURSOR_SERVICE, useExisting: SessionCursorService },
    SessionMapper,
    SessionQueryService,
    { provide: SESSION_QUERY_SERVICE, useExisting: SessionQueryService },
    SessionListService,
    { provide: SESSION_LIST_SERVICE, useExisting: SessionListService },
    SessionIssueUseCase,
    { provide: SESSION_ISSUE_USE_CASE, useExisting: SessionIssueUseCase },
    SessionRotationUseCase,
    { provide: SESSION_ROTATION_USE_CASE, useExisting: SessionRotationUseCase },
    SessionRevocationUseCase,
    {
      provide: SESSION_REVOCATION_USE_CASE,
      useExisting: SessionRevocationUseCase
    }
  ],
  controllers: [SessionsController],
  exports: [
    SESSION_REPOSITORY,
    SESSION_CURSOR_SERVICE,
    SESSION_QUERY_SERVICE,
    SESSION_LIST_SERVICE,
    SESSION_ISSUE_USE_CASE,
    SESSION_ROTATION_USE_CASE,
    SESSION_REVOCATION_USE_CASE
  ]
})
export class SessionsModule {}
