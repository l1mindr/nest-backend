import { ClearCsrfCookieInterceptor } from '@features/security/csrf/interceptors/clear-csrf-cookie.interceptor';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/entities/user.entity';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query,
  UseInterceptors
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SessionListRequestDto } from './dto/request/session-list-request.dto';
import { SessionResponseDto } from './dto/response/session.response.dto';
import { Session as SessionEntity } from './entities/session.entity';
import {
  IListSessionsService,
  IRevokeSessionService,
  ITerminateOtherSessionsService,
  LIST_SESSIONS_SERVICE,
  REVOKE_SESSION_SERVICE,
  TERMINATE_OTHER_SESSIONS_SERVICE
} from './interfaces/sessions.interface';
import {
  ApiGetSessions,
  ApiRevokeCurrentSession,
  ApiTerminateOtherSessions
} from './sessions.swagger';

@Controller({
  path: 'sessions',
  version: '1'
})
export class SessionsController {
  constructor(
    @Inject(LIST_SESSIONS_SERVICE)
    private readonly listSessionsService: IListSessionsService,
    @Inject(REVOKE_SESSION_SERVICE)
    private readonly revokeSessionService: IRevokeSessionService,
    @Inject(TERMINATE_OTHER_SESSIONS_SERVICE)
    private readonly terminateOtherSessionsService: ITerminateOtherSessionsService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetSessions()
  async listSessions(
    @User() user: UserEntity,
    @Session() session: SessionEntity,
    @Query() query: SessionListRequestDto
  ) {
    const { currentSession, items, nextCursor } =
      await this.listSessionsService.listSessions(
        user.id,
        session,
        query.limit,
        query.cursor
      );

    return {
      currentSession: plainToInstance(SessionResponseDto, currentSession, {
        excludeExtraneousValues: true
      }),
      items: plainToInstance(SessionResponseDto, items, {
        excludeExtraneousValues: true
      }),
      nextCursor
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(ClearCsrfCookieInterceptor)
  @ApiRevokeCurrentSession()
  revokeSession(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.revokeSessionService.revokeSession(user.id, session.id);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTerminateOtherSessions()
  terminateOtherSessions(
    @User() user: UserEntity,
    @Session() session: SessionEntity
  ) {
    return this.terminateOtherSessionsService.terminateOtherSessions(
      user.id,
      session.id
    );
  }
}
