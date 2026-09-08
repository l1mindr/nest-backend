import { ClearAuthCookiesInterceptor } from '@features/auth/presentation/interceptors/clear-auth-cookies.interceptor';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { ApiTags } from '@nestjs/swagger';
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
import { SessionMapper } from '../../application/mappers/session.mapper';
import { SessionListRequestDto } from '../dto/request/session-list-request.dto';
import { Session as SessionEntity } from '../../domain/entities/session.entity';
import {
  ISessionListService,
  ISessionRevocationUseCase,
  SESSION_LIST_SERVICE,
  SESSION_REVOCATION_USE_CASE
} from '../../application/interfaces/sessions.interface';
import {
  ApiGetSessions,
  ApiRevokeCurrentSession,
  ApiTerminateOtherSessions
} from '../swagger/sessions.swagger';

@Controller({
  path: 'sessions',
  version: '1'
})
@ApiTags(ApiTagName.SESSIONS)
export class SessionsController {
  constructor(
    @Inject(SESSION_LIST_SERVICE)
    private readonly listService: ISessionListService,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
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
  // Logout clears every auth cookie, not just the CSRF one: leaving the two
  // HttpOnly token cookies behind meant the browser kept presenting dead
  // credentials until they expired (15 minutes / 7 days).
  @UseInterceptors(ClearAuthCookiesInterceptor)
  @ApiRevokeCurrentSession()
  revokeSession(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.revocationUseCase.revoke(user.id, session.id);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTerminateOtherSessions()
  terminateOtherSessions(
    @User() user: UserEntity,
    @Session() session: SessionEntity
  ) {
    return this.revocationUseCase.terminateOthers(user.id, session.id);
  }
}
