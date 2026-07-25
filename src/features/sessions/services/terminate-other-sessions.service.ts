import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { ITerminateOtherSessionsService } from '../interfaces/sessions.interface';

@Injectable()
export class TerminateOtherSessionsService implements ITerminateOtherSessionsService {
  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  constructor(private readonly dataSource: DataSource) {}

  async terminateOthers(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(Session) ?? this.sessionRepo;

    await repository.update(
      {
        owner: { id: userId },
        id: Not(sessionId)
      },
      {
        isRevoked: true
      }
    );
  }
}
