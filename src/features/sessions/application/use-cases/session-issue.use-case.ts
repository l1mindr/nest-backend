import { ClockService } from '@core/clock/clock.service';
import { User } from '@features/users/entities/user.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { Session } from '../../entities/session.entity';
import { ISessionDevice } from '../../interfaces/session-device.interface';
import {
  ISessionIssueUseCase,
  ISessionRepository,
  SESSION_REPOSITORY
} from '../../interfaces/sessions.interface';

@Injectable()
export class SessionIssueUseCase implements ISessionIssueUseCase {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async execute(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session> {
    const maxSessions = this.configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );

    const { now } = this.clockService.snapshot();
    const nowDate = this.clockService.dateFromMs(now);

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .select('user.id')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOneOrFail();

      const session = await this.sessionRepository.createSession({
        userId,
        ipAddress,
        device,
        expiresAt,
        now: nowDate,
        manager
      });

      const activeCount = await this.sessionRepository.countActiveSessions(
        userId,
        nowDate,
        manager
      );

      if (activeCount > maxSessions) {
        const excess = activeCount - maxSessions;

        const toRevoke = await manager
          .getRepository(Session)
          .createQueryBuilder('session')
          .select('session.id')
          .where('session.owner = :userId', { userId })
          .andWhere('session.isRevoked = false')
          .andWhere('session.expiresAt > :now', { now: nowDate })
          .orderBy('session.lastUsedAt', 'ASC')
          .addOrderBy('session.createdAt', 'ASC')
          .addOrderBy('session.id', 'ASC')
          .take(excess)
          .getMany();

        if (toRevoke.length) {
          const ids = toRevoke.map((s) => s.id);
          await manager
            .getRepository(Session)
            .update({ id: In(ids) }, { isRevoked: true });
        }
      }

      return session;
    });
  }
}
