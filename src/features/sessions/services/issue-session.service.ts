import { ClockService } from '@core/clock/clock.service';
import { User } from '@features/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { ISessionDevice } from '../interfaces/session-device.interface';
import { IIssueSessionService } from '../interfaces/sessions.interface';

@Injectable()
export class IssueSessionService implements IIssueSessionService {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource
  ) {}

  async issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session> {
    const maxSessions = this.configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .select('user.id')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOneOrFail();

      const repository = manager.getRepository(Session);
      const now = this.clockService.nowDate();
      const session = await this.createSession(
        repository,
        userId,
        ipAddress,
        device,
        expiresAt,
        now
      );
      const active = await repository.find({
        where: {
          owner: { id: userId },
          isRevoked: false,
          expiresAt: MoreThan(now)
        },
        select: { id: true },
        order: {
          lastUsedAt: 'ASC',
          createdAt: 'ASC',
          id: 'ASC'
        }
      });

      if (active.length > maxSessions) {
        const toRevoke = active
          .slice(0, active.length - maxSessions)
          .map((activeSession) => activeSession.id);

        if (toRevoke.length) {
          await repository.update({ id: In(toRevoke) }, { isRevoked: true });
        }
      }

      return session;
    });
  }

  private createSession(
    repository: Repository<Session>,
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date,
    now: Date
  ): Promise<Session> {
    return repository.save(
      repository.create({
        owner: { id: userId },
        ipAddress,
        device,
        expiresAt,
        lastUsedAt: now,
        refreshTokenHash: randomUUID()
      })
    );
  }
}
