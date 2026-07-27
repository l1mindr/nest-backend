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
import { SessionMapper } from './application/mapping/session.mapper';
import { SessionListRequestDto } from './dto/request/session-list-request.dto';
import { Session as SessionEntity } from './entities/session.entity';
import {
  ISessionListService,
  ISessionRevocationService,
  SESSION_LIST_SERVICE,
  SESSION_REVOCATION_SERVICE
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
    @Inject(SESSION_LIST_SERVICE)
    private readonly listService: ISessionListService,
    @Inject(SESSION_REVOCATION_SERVICE)
    private readonly revocationService: ISessionRevocationService,
    private readonly sessionMapper: SessionMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetSessions()
  async listSessions(
    @User() user: UserEntity,
    @Session() session: SessionEntity,
    @Query() query: SessionListRequestDto
  ) {
    const { currentSession, items, nextCursor } = await this.listService.list(
      user.id,
      session,
      query.limit,
      query.cursor
    );

    return {
      currentSession: this.sessionMapper.toResponse(currentSession),
      items: this.sessionMapper.toResponseList(items),
      nextCursor
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(ClearCsrfCookieInterceptor)
  @ApiRevokeCurrentSession()
  revokeSession(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.revocationService.revoke(user.id, session.id);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTerminateOtherSessions()
  terminateOtherSessions(
    @User() user: UserEntity,
    @Session() session: SessionEntity
  ) {
    return this.revocationService.terminateOthers(user.id, session.id);
  }
}
