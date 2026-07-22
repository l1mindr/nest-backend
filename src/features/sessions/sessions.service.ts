import { ClockService } from '@core/clock/clock.service';
import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { SESSION_PAGE_SIZE_DEFAULT } from './dto/request/session-list-request.dto';
import { SessionErrors } from './errors/session-errors';
import { ISessionDevice } from './interfaces/session-device.interface';
import {
  ISessionsService,
  SessionListResult
} from './interfaces/sessions.interface';
import { SessionListItem } from './types/session-list-item.type';

@Injectable()
export class SessionsService implements ISessionsService {
  constructor(
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SessionsService.name);
  }

  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  async issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ) {
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

  async list(
    userId: string,
    session: Session,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult> {
    const take = limit ?? SESSION_PAGE_SIZE_DEFAULT;
    const cursorData = this.decodeCursor(cursor);

    const qb = this.sessionRepo
      .createQueryBuilder('session')
      .where('session.owner = :userId', { userId })
      .andWhere('session.isRevoked = false')
      .andWhere('session.expiresAt > :now', {
        now: this.clockService.nowDate()
      })
      .andWhere('session.id != :currentSessionId', {
        currentSessionId: session.id
      })
      .orderBy('session.lastUsedAt', 'ASC')
      .addOrderBy('session.id', 'ASC')
      .take(take + 1);

    if (cursorData) {
      qb.andWhere(
        `(session."lastUsedAt" > :cursorLastUsedAt OR (session."lastUsedAt" = :cursorLastUsedAt AND session."id" > :cursorId))`,
        {
          cursorLastUsedAt: cursorData.lastUsedAt,
          cursorId: cursorData.id
        }
      );
    }

    const sessions = await qb.getMany();

    const hasMore = sessions.length > take;
    const page = hasMore ? sessions.slice(0, take) : sessions;
    const nextCursor = hasMore
      ? this.encodeCursor(page[page.length - 1])
      : null;

    const items = page.map((s) => this.toListItem(s));

    return {
      currentSession: this.toListItem(session),
      items,
      nextCursor
    };
  }

  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private encodeCursor(session: Session): string {
    const payload = {
      lastUsedAt: session.lastUsedAt.toISOString(),
      id: session.id
    };

    return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  }

  private decodeCursor(
    cursor?: string
  ): { lastUsedAt: Date; id: string } | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    } catch {
      throw SessionErrors.invalidCursor();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(decoded);
    } catch {
      throw SessionErrors.invalidCursor();
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as Record<string, unknown>).lastUsedAt !== 'string' ||
      typeof (payload as Record<string, unknown>).id !== 'string'
    ) {
      throw SessionErrors.invalidCursor();
    }

    const { lastUsedAt, id } = payload as {
      lastUsedAt: string;
      id: string;
    };

    const lastUsedAtDate = new Date(lastUsedAt);

    if (isNaN(lastUsedAtDate.getTime()) || !SessionsService.UUID_RE.test(id)) {
      throw SessionErrors.invalidCursor();
    }

    return { lastUsedAt: lastUsedAtDate, id };
  }

  private toListItem(session: Session): SessionListItem {
    return {
      sessionId: session.id,
      ipAddress: session.ipAddress,
      deviceInfo: session.device,
      validUntil: session.expiresAt,
      lastActivityAt: session.lastUsedAt
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
