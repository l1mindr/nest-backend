import { Inject, Injectable } from '@nestjs/common';
import { Session } from '../../domain/entities/session.entity';
import {
  ISessionRepository,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class SessionQueryService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  findActive(userId: string, sessionId: string): Promise<Session | null> {
    return this.sessionRepository.findActiveSession(userId, sessionId);
  }
}
