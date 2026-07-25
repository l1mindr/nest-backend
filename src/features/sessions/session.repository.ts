import { ClockService } from '@core/clock/clock.service';
import { User } from '@features/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { ISessionRepository } from './interfaces/sessions.interface';

@Injectable()
export class SessionRepository implements ISessionRepository {
  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  constructor(
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource
  ) {}

  async getActive(userId: string, sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findOne({
      where: {
        id: sessionId,
        isRevoked: false,
        expiresAt: MoreThan(this.clockService.nowDate()),
        owner: {
          id: userId
        }
      }
    });
  }

  async getUserAndActiveSession(
    userId: string,
    sessionId: string
  ): Promise<{
    user: User | null;
    session: Session | null;
  }> {
    const now = this.clockService.nowDate();

    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .leftJoinAndSelect(
        'user.sessions',
        'session',
        'session.id = :sessionId AND session.isRevoked = false AND session.expiresAt > :now',
        { sessionId, now }
      )
      .where('user.id = :userId', { userId })
      .select([
        'user.id',
        'user.email',
        'user.username',
        'user.name',
        'user.status',
        'user.role',
        'user.registryDates.createdAt',
        'session.id',
        'session.refreshTokenHash',
        'session.ipAddress',
        'session.device',
        'session.expiresAt',
        'session.lastUsedAt',
        'session.version',
        'session.rotatedAt',
        'session.createdAt',
        'session.updatedAt'
      ])
      .getOne();

    if (!user) return { user: null, session: null };

    return { user, session: user.sessions?.[0] ?? null };
  }

  async rotateAtomic(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean> {
    const now = this.clockService.dateFromMs(meta.now);
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(Session)
      .set({
        refreshTokenHash: newHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: meta.expiresAt,
        version: () => '"version" + 1'
      })
      .where('id = :id', { id: sessionId })
      .andWhere('refreshTokenHash = :hash', { hash: oldHash })
      .andWhere('version = :version', { version })
      .execute();

    return (result.affected ?? 0) === 1;
  }
}
