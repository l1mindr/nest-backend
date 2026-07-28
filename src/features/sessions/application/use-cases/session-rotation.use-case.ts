import { Inject, Injectable } from '@nestjs/common';
import { Session } from '../../domain/entities/session.entity';
import {
  ISessionRepository,
  ISessionRotationUseCase,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class SessionRotationUseCase implements ISessionRotationUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async execute(
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

  async saveHash(session: Session): Promise<Session> {
    return this.sessionRepository.saveRefreshTokenHash(session);
  }
}
