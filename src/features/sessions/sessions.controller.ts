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
  ISessionsService,
  SESSION_SERVICE
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
    @Inject(SESSION_SERVICE)
    private readonly sessionsService: ISessionsService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetSessions()
  async getAll(
    @User() user: UserEntity,
    @Session() session: SessionEntity,
    @Query() query: SessionListRequestDto
  ) {
    const { currentSession, items, nextCursor } =
      await this.sessionsService.list(
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
  revoke(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.sessionsService.revoke(user.id, session.id);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTerminateOtherSessions()
  terminateOthers(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.sessionsService.terminateOthers(user.id, session.id);
  }
}
