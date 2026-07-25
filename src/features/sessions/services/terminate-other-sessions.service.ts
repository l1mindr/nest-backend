import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ISessionRepository,
  ITerminateOtherSessionsService,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class TerminateOtherSessionsService implements ITerminateOtherSessionsService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async terminateOtherSessions(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.sessionRepository.revokeSessionsExceptCurrent(
      userId,
      sessionId,
      manager
    );
  }
}
