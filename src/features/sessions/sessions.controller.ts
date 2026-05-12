import { User } from '@features/auth/decorators/user.decorator';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
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
  getAll(@User() customAuth: CustomAuth) {
    return this.sessionsService.list(customAuth);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRevokeCurrentSession()
  revoke(@User() { user, session }: CustomAuth) {
    return this.sessionsService.revoke(user, session.refreshTokenHash);
  }

  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTerminateOtherSessions()
  terminateOthers(@User() { user, session }: CustomAuth) {
    return this.sessionsService.terminateOthers(user, session.refreshTokenHash);
  }
}
