import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import {
  DataSource,
  EntityManager,
  In,
  MoreThan,
  Not,
  Repository
} from 'typeorm';
import { ISessionDevice } from './interfaces/session-device.interface';
import { ISessionsService } from './interfaces/sessions.interface';
import { SessionListItem } from './types/session-list-item.type';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SessionsService.name);
  }

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  private static readonly DEFAULT_MAX_ACTIVE_SESSIONS = 10;

  async issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ) {
    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        owner: { id: userId },
        ipAddress,
        device,
        expiresAt,
        lastUsedAt: new Date(),
        refreshTokenHash: randomUUID()
      })
    );

    const maxSessions =
      Number(process.env.MAX_ACTIVE_SESSIONS) ||
      SessionsService.DEFAULT_MAX_ACTIVE_SESSIONS;

    if (maxSessions > 0) {
      const now = new Date();
      const active = await this.sessionRepo.find({
        where: {
          owner: { id: userId },
          isRevoked: false,
          expiresAt: MoreThan(now)
        },
        select: { id: true },
        order: { createdAt: 'ASC' }
      });

      if (active.length > maxSessions) {
        const toRevoke = active
          .slice(0, active.length - maxSessions)
          .map((s) => s.id);
        if (toRevoke.length) {
          await this.sessionRepo.update(
            { id: In(toRevoke) },
            { isRevoked: true }
          );
        }
      }
    }

    return session;
  }

  async getActive(userId: string, sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findOne({
      where: {
        id: sessionId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
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
    const now = new Date();

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

  async list(userId: string, session: Session): Promise<SessionListItem[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        owner: { id: userId },
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        id: Not(session.id)
      },
      select: {
        id: true,
        ipAddress: true,
        device: true,
        expiresAt: true,
        lastUsedAt: true
      }
    });

    return [
      this.toListItem(session, true),
      ...sessions.map((s) => this.toListItem(s))
    ];
  }

  private toListItem(session: Session, current?: boolean): SessionListItem {
    return {
      sessionId: session.id,
      ipAddress: session.ipAddress,
      deviceInfo: session.device,
      validUntil: session.expiresAt,
      lastActivityAt: session.lastUsedAt,
      ...(current !== undefined && { current })
    };
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      {
        owner: { id: userId },
        id: sessionId
      },
      {
        isRevoked: true
      }
    );

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId, sessionId },
      'Session revoked'
    );
  }

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

  async updateRefreshState(
    session: Session,
    payload: Partial<Session>
  ): Promise<void> {
    Object.assign(session, payload);
    await this.sessionRepo.save(session);
  }

  async rotateAtomic(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean> {
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(Session)
      .set({
        refreshTokenHash: newHash,
        rotatedAt: new Date(meta.now),
        lastUsedAt: new Date(meta.now),
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
