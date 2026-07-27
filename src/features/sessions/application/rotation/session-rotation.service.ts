import { Inject, Injectable } from '@nestjs/common';
import { Session } from '../../entities/session.entity';
import {
  ISessionRepository,
  SESSION_REPOSITORY
} from '../../interfaces/sessions.interface';

@Injectable()
export class SessionRotationService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  rotate(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean> {
    return this.sessionRepository.rotateRefreshToken(
      sessionId,
      version,
      oldHash,
      newHash,
      meta
    );
  }

  saveHash(session: Session): Promise<Session> {
    return this.sessionRepository.saveRefreshTokenHash(session);
  }
}
