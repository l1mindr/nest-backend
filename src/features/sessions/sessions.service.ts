import { Session } from '@features/sessions/entities/session.entity';
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
import { SessionListResponseDto } from './dto/response/session-list-response.dto';
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
  private static readonly DEFAULT_MAX_PAGE_SIZE = 50;

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

    // Enforce maximum active sessions per user. Configurable via env var.
    const maxSessions =
      Number(process.env.MAX_ACTIVE_SESSIONS) ||
      SessionsService.DEFAULT_MAX_ACTIVE_SESSIONS;

    if (maxSessions > 0) {
      // Count active sessions
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

  /**
   * Cursor-based pagination for sessions. Returns items and nextCursor if more.
   * Ordering: createdAt DESC, id DESC (stable)
   */
  async listCursor(
    userId: string,
    session: Session,
    cursor?: string,
    limit = 25
  ): Promise<SessionListResponseDto> {
    const pageSize = Math.min(
      limit,
      Number(process.env.SESSIONS_PAGE_MAX) ||
        SessionsService.DEFAULT_MAX_PAGE_SIZE
    );

    const qb = this.sessionRepo.createQueryBuilder('session');

    qb.where('session.ownerId = :userId', { userId })
      .andWhere('session.isRevoked = false')
      .andWhere('session.expiresAt > :now', { now: new Date() });

    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, 'base64').toString('utf8')
        ) as {
          createdAt: string;
          id: string;
        };
        const cursorDate = new Date(decoded.createdAt);
        qb.andWhere(
          '(session.createdAt < :cursorDate OR (session.createdAt = :cursorDate AND session.id < :cursorId))',
          { cursorDate, cursorId: decoded.id }
        );
      } catch {
        // ignore invalid cursor
      }
    }

    qb.orderBy('session.createdAt', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .take(pageSize + 1);

    const rows = await qb.getMany();

    let nextCursor: string | undefined;
    let items = rows;
    if (rows.length > pageSize) {
      const last = rows[pageSize - 1];
      items = rows.slice(0, pageSize);
      const payload = { createdAt: last.createdAt.toISOString(), id: last.id };
      nextCursor = Buffer.from(JSON.stringify(payload)).toString('base64');
    }

    const dtoItems = items.map((s) => this.toListItem(s));

    return {
      items: dtoItems,
      nextCursor
    } as SessionListResponseDto;
  }

  /** Remove expired sessions. Returns number of revoked sessions. */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(Session)
      .set({ isRevoked: true })
      .where('expiresAt <= :now', { now })
      .andWhere('isRevoked = false')
      .execute();

    return result.affected ?? 0;
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

  async updateRefreshState(
    session: Session,
    payload: Partial<Session>
  ): Promise<void> {
    Object.assign(session, payload);
    await this.sessionRepo.save(session);
  }

  async rotateRefreshToken(
    sessionId: string,
    oldHash: string,
    newHash: string,
    meta: {
      lastUsedAt: Date;
      expiresAt: Date;
      rotatedAt: Date;
    }
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Session);

      const session = await repo
        .createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: sessionId })
        .getOne();

      if (!session) return false;

      if (session.refreshTokenHash !== oldHash) {
        return false;
      }

      const result = await repo.update(
        {
          id: sessionId,
          refreshTokenHash: oldHash
        },
        {
          refreshTokenHash: newHash,
          rotatedAt: meta.rotatedAt,
          lastUsedAt: meta.lastUsedAt,
          expiresAt: meta.expiresAt
        }
      );

      return result.affected === 1;
    });
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
