import { ClockService } from '@core/clock/clock.service';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, Not, Repository } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import { ISessionDevice } from '../../application/interfaces/session-device.interface';
import { ISessionRepository } from '../../application/interfaces/sessions.interface';

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

  async countActiveSessions(
    userId: string,
    now: Date,
    manager?: EntityManager
  ): Promise<number> {
    const repository = manager?.getRepository(Session) ?? this.sessionRepo;

    return repository.count({
      where: {
        owner: { id: userId },
        isRevoked: false,
        expiresAt: MoreThan(now)
      }
    });
  }

  async createSession(params: {
    userId: string;
    ipAddress: string;
    device: ISessionDevice;
    expiresAt: Date;
    now: Date;
    manager?: EntityManager;
  }): Promise<Session> {
    const { userId, ipAddress, device, expiresAt, now, manager } = params;

    const repository = manager?.getRepository(Session) ?? this.sessionRepo;

    return repository.save(
      repository.create({
        owner: { id: userId },
        ipAddress,
        device,
        expiresAt,
        lastUsedAt: now,
        refreshTokenHash: crypto.randomUUID()
      })
    );
  }
}
