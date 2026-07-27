import { SessionContext } from '@core/http/session-context.interface';
import { ClockService } from '@core/clock/clock.service';
import { paginate } from '@core/pagination/paginate.util';
import { Inject, Injectable } from '@nestjs/common';
import { SESSION_PAGE_SIZE_DEFAULT } from '../../dto/request/session-list-request.dto';
import { SessionCursorService } from './session-cursor.service';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
  SessionListResult
} from '../../interfaces/sessions.interface';
import { SessionListItem } from '../../types/session-list-item.type';

@Injectable()
export class SessionListService {
  constructor(
    private readonly clockService: ClockService,
    private readonly cursorService: SessionCursorService,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async list(
    userId: string,
    session: SessionContext,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult> {
    const take = limit ?? SESSION_PAGE_SIZE_DEFAULT;
    const cursorData = this.cursorService.decode(cursor);

    const sessions = await this.sessionRepository.listUserSessions(
      userId,
      session.id,
      {
        now: this.clockService.nowDate(),
        limit: take,
        cursor: cursorData ?? undefined
      }
    );

    const paginated = paginate(sessions, take, (s) =>
      this.cursorService.encode({
        lastUsedAt: s.lastUsedAt,
        id: s.id
      })
    );

    return {
      currentSession: this.toListItem(session),
      ...paginated,
      items: paginated.items.map((s) => this.toListItem(s))
    };
  }

  private toListItem(session: SessionContext): SessionListItem {
    return {
      sessionId: session.id,
      ipAddress: session.ipAddress,
      deviceInfo: session.device,
      validUntil: session.expiresAt,
      lastActivityAt: session.lastUsedAt
    };
  }
}
