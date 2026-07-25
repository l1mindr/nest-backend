import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { IRevokeAllUserSessionsService } from '../interfaces/sessions.interface';

@Injectable()
export class RevokeAllUserSessionsService implements IRevokeAllUserSessionsService {
  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokeAllUserSessionsService.name);
  }

  async revokeAllForUser(
    userId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(Session) ?? this.sessionRepo;

    await repository.update(
      {
        owner: { id: userId },
        isRevoked: false
      },
      {
        isRevoked: true
      }
    );

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId },
      'All sessions revoked for user'
    );
  }
}
