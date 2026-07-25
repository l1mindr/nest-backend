import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import {
  ISSUE_SESSION_SERVICE,
  LIST_SESSIONS_SERVICE,
  REVOKE_ALL_USER_SESSIONS_SERVICE,
  REVOKE_SESSION_SERVICE,
  SESSION_REPOSITORY,
  TERMINATE_OTHER_SESSIONS_SERVICE
} from './interfaces/sessions.interface';
import { IssueSessionService } from './services/issue-session.service';
import { ListSessionsService } from './services/list-sessions.service';
import { RevokeAllUserSessionsService } from './services/revoke-all-user-sessions.service';
import { RevokeSessionService } from './services/revoke-session.service';
import { SessionRepository } from './repositories/session.repository';
import { SessionsController } from './sessions.controller';
import { TerminateOtherSessionsService } from './services/terminate-other-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [
    SessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: SessionRepository },
    IssueSessionService,
    { provide: ISSUE_SESSION_SERVICE, useExisting: IssueSessionService },
    ListSessionsService,
    { provide: LIST_SESSIONS_SERVICE, useExisting: ListSessionsService },
    RevokeSessionService,
    { provide: REVOKE_SESSION_SERVICE, useExisting: RevokeSessionService },
    TerminateOtherSessionsService,
    {
      provide: TERMINATE_OTHER_SESSIONS_SERVICE,
      useExisting: TerminateOtherSessionsService
    },
    RevokeAllUserSessionsService,
    {
      provide: REVOKE_ALL_USER_SESSIONS_SERVICE,
      useExisting: RevokeAllUserSessionsService
    }
  ],
  controllers: [SessionsController],
  exports: [
    SESSION_REPOSITORY,
    ISSUE_SESSION_SERVICE,
    LIST_SESSIONS_SERVICE,
    REVOKE_SESSION_SERVICE,
    TERMINATE_OTHER_SESSIONS_SERVICE,
    REVOKE_ALL_USER_SESSIONS_SERVICE
  ]
})
export class SessionsModule {}
