import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { ClearCsrfCookieInterceptor } from '@features/security/csrf/interceptors/clear-csrf-cookie.interceptor';
import { User as UserEntity } from '@features/users/entities/user.entity';
import { Serialize } from '@infrastructure/http/interceptors/decorators/serialize.decorator';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  UseInterceptors
} from '@nestjs/common';
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
  @Serialize(SessionResponseDto)
  getAll(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.sessionsService.list(user.id, session);
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
