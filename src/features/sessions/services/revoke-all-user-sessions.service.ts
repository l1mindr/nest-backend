import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { EntityManager } from 'typeorm';
import {
  ISessionRepository,
  IRevokeAllUserSessionsService,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class RevokeAllUserSessionsService implements IRevokeAllUserSessionsService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokeAllUserSessionsService.name);
  }

  async revokeAllSessionsForUser(
    userId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.sessionRepository.revokeAllSessionsForUser(userId, manager);

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId },
      'All sessions revoked for user'
    );
  }
}
