import { ClockService } from '@core/clock/clock.service';
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

    if (
      isNaN(lastUsedAtDate.getTime()) ||
      !ListSessionsService.UUID_RE.test(id)
    ) {
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
