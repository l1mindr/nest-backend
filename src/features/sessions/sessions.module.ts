import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionCursorService } from './application/cursor/session-cursor.service';
import { SessionIssueService } from './application/issue/session-issue.service';
import { SessionMapper } from './application/mapping/session.mapper';
import { SessionListService } from './application/query/session-list.service';
import { SessionQueryService } from './application/query/session-query.service';
import { SessionRevocationService } from './application/revocation/session-revocation.service';
import { SessionRotationService } from './application/rotation/session-rotation.service';
import { Session } from './entities/session.entity';
import {
  SESSION_CURSOR_SERVICE,
  SESSION_ISSUE_SERVICE,
  SESSION_LIST_SERVICE,
  SESSION_QUERY_SERVICE,
  SESSION_REPOSITORY,
  SESSION_REVOCATION_SERVICE,
  SESSION_ROTATION_SERVICE
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
    SessionIssueService,
    { provide: SESSION_ISSUE_SERVICE, useExisting: SessionIssueService },
    SessionRotationService,
    { provide: SESSION_ROTATION_SERVICE, useExisting: SessionRotationService },
    SessionRevocationService,
    {
      provide: SESSION_REVOCATION_SERVICE,
      useExisting: SessionRevocationService
    }
  ],
  controllers: [SessionsController],
  exports: [
    SESSION_REPOSITORY,
    SESSION_CURSOR_SERVICE,
    SESSION_QUERY_SERVICE,
    SESSION_LIST_SERVICE,
    SESSION_ISSUE_SERVICE,
    SESSION_ROTATION_SERVICE,
    SESSION_REVOCATION_SERVICE
  ]
})
export class SessionsModule {}
