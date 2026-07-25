import { ClockService } from '@core/clock/clock.service';
import { User } from '@features/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  In,
  MoreThan,
  Not,
  Repository
} from 'typeorm';
import { Session } from '../entities/session.entity';
import { ISessionDevice } from '../interfaces/session-device.interface';
import { ISessionRepository } from '../interfaces/sessions.interface';

@Injectable()
export class SessionRepository implements ISessionRepository {
  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  constructor(
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource
  ) {}

  async findActiveSession(
    userId: string,
    sessionId: string
  ): Promise<Session | null> {
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

  async findUserWithActiveSession(
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

  async rotateRefreshToken(
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

  async saveRefreshTokenHash(session: Session): Promise<Session> {
    return this.sessionRepo.save(session);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id: userId },
        id: sessionId
      },
      {
        isRevoked: true
      }
    );
  }

  async revokeAllSessionsForUser(
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
  }

  async revokeSessionsExceptCurrent(
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

  async listUserSessions(
    userId: string,
    currentSessionId: string,
    options: {
      now: Date;
      limit: number;
      cursor?: { lastUsedAt: Date; id: string };
    }
  ): Promise<Session[]> {
    const qb = this.sessionRepo
      .createQueryBuilder('session')
      .where('session.owner = :userId', { userId })
      .andWhere('session.isRevoked = false')
      .andWhere('session.expiresAt > :now', { now: options.now })
      .andWhere('session.id != :currentSessionId', { currentSessionId })
      .orderBy('session.lastUsedAt', 'ASC')
      .addOrderBy('session.id', 'ASC')
      .take(options.limit + 1);

    if (options.cursor) {
      qb.andWhere(
        `(session."lastUsedAt" > :cursorLastUsedAt OR (session."lastUsedAt" = :cursorLastUsedAt AND session."id" > :cursorId))`,
        {
          cursorLastUsedAt: options.cursor.lastUsedAt,
          cursorId: options.cursor.id
        }
      );
    }

    return qb.getMany();
  }

  async createSession(params: {
    userId: string;
    ipAddress: string;
    device: ISessionDevice;
    expiresAt: Date;
    now: Date;
    maxSessions: number;
  }): Promise<Session> {
    const { userId, ipAddress, device, expiresAt, now, maxSessions } = params;

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .select('user.id')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOneOrFail();

      const repository = manager.getRepository(Session);

      const session = await repository.save(
        repository.create({
          owner: { id: userId },
          ipAddress,
          device,
          expiresAt,
          lastUsedAt: now,
          refreshTokenHash: crypto.randomUUID()
        })
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
}
