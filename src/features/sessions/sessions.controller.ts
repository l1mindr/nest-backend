import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/entities/user.entity';
import { Serialize } from '@infrastructure/http/interceptors/decorators/serialize.decorator';
import { Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionResponseDto } from './dto/response/session.response.dto';
import { Session as SessionEntity } from './entities/session.entity';
import { SessionsService } from './sessions.service';
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
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetSessions()
  @Serialize(SessionResponseDto)
  getAll(@User() user: UserEntity, @Session() session: SessionEntity) {
    return this.sessionsService.list(user.id, session);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
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
