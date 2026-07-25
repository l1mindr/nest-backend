import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ISessionRepository,
  IRevokeSessionService,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class RevokeSessionService implements IRevokeSessionService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokeSessionService.name);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepository.revokeSession(userId, sessionId);

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId, sessionId },
      'Session revoked'
    );
  }
}
