import { decodeCursor, encodeCursor } from '@core/pagination/cursor.util';
import { Injectable } from '@nestjs/common';
import { ActivityErrors } from '../../domain/errors/activity-errors';
import {
  UserActivityCursor,
  UserActivityDocument,
  UserActivityItem
} from '../interfaces/activity.interface';

@Injectable()
export class UserActivityMapper {
  /**
   * Persisted document → API item.
   *
   * `userId` is not carried across. The endpoint only ever returns the
   * caller's own activities, so echoing the id back says nothing the caller
   * does not know, and leaving it out means a future response cannot leak one
   * by accident. `expiresAt` is likewise internal — retention is a property of
   * the store, not something a client acts on.
   */
  toItem(document: UserActivityDocument): UserActivityItem {
    return {
      id: String(document._id),
      category: document.category,
      action: document.action,
      entityType: document.entityType ?? null,
      entityId: document.entityId ?? null,
      metadata: document.metadata ?? null,
      createdAt: new Date(document.createdAt).toISOString()
    };
  }

  encodeCursor(document: UserActivityDocument): string {
    return encodeCursor(
      JSON.stringify({
        createdAt: new Date(document.createdAt).toISOString(),
        id: String(document._id)
      } satisfies UserActivityCursor)
    );
  }

  /** @throws {AppError} `ACTIVITY_INVALID_CURSOR` when the cursor is unusable. */
  decodeCursor(cursor: string): UserActivityCursor {
    try {
      const payload = JSON.parse(decodeCursor(cursor)) as unknown;

      if (!this.isCursor(payload)) {
        throw ActivityErrors.invalidCursor();
      }

      return payload;
    } catch {
      // Also covers a malformed base64url body and invalid JSON.
      throw ActivityErrors.invalidCursor();
    }
  }

  private isCursor(payload: unknown): payload is UserActivityCursor {
    if (typeof payload !== 'object' || payload === null) return false;

    const candidate = payload as Record<string, unknown>;

    return (
      typeof candidate.createdAt === 'string' &&
      !Number.isNaN(Date.parse(candidate.createdAt)) &&
      typeof candidate.id === 'string' &&
      candidate.id.length > 0
    );
  }
}
