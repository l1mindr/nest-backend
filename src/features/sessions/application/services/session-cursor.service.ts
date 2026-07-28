import {
  decodeCursor,
  encodeCursor,
  isValidUUID
} from '@core/pagination/cursor.util';
import { Injectable } from '@nestjs/common';
import { SessionErrors } from '../../domain/errors/session-errors';

@Injectable()
export class SessionCursorService {
  encode(data: { lastUsedAt: Date; id: string }): string {
    return encodeCursor(
      JSON.stringify({
        lastUsedAt: data.lastUsedAt.toISOString(),
        id: data.id
      })
    );
  }

  decode(cursor?: string): { lastUsedAt: Date; id: string } | null {
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
}
