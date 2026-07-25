import { ClockService } from '@core/clock/clock.service';
import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { paginate } from '@core/pagination/paginate.util';
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SESSION_PAGE_SIZE_DEFAULT } from '../dto/request/session-list-request.dto';
import { SessionErrors } from '../errors/session-errors';
import { Session } from '../entities/session.entity';
import {
  IListSessionsService,
  SessionListResult
} from '../interfaces/sessions.interface';
import { SessionListItem } from '../types/session-list-item.type';

@Injectable()
export class ListSessionsService implements IListSessionsService {
  private get sessionRepo(): Repository<Session> {
    return this.dataSource.getRepository(Session);
  }

  constructor(
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource
  ) {}

  async list(
    userId: string,
    session: Session,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult> {
    const take = limit ?? SESSION_PAGE_SIZE_DEFAULT;
    const cursorData = this.parseCursor(cursor);

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

    const paginated = paginate(sessions, take, (s) =>
      encodeCursor(
        JSON.stringify({
          lastUsedAt: s.lastUsedAt.toISOString(),
          id: s.id
        })
      )
    );

    return {
      currentSession: this.toListItem(session),
      ...paginated,
      items: paginated.items.map((s) => this.toListItem(s))
    };
  }

  private parseCursor(
    cursor?: string
  ): { lastUsedAt: Date; id: string } | null {
    if (!cursor) return null;

    let decoded: string;
    try {
      decoded = decodeCursor(cursor);
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

    if (isNaN(lastUsedAtDate.getTime()) || !isValidUUID(id)) {
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
}
