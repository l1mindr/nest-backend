import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClockService } from '@infrastructure/clock/clock.service';
import { MONGODB_CONNECTION_NAME } from '@infrastructure/logging/mongodb/mongodb.constants';
import { sanitizeMetadata } from '@infrastructure/logging/audit/metadata-sanitizer';
import { ACTIVITY_RETENTION_DAYS } from '../../domain/activity-catalog';
import {
  CreateUserActivityInput,
  IUserActivityRepository,
  UserActivityDocument,
  UserActivityQueryFilter
} from '../../application/interfaces/activity.interface';
import { UserActivity } from '../schemas/user-activity.schema';

@Injectable()
export class UserActivityRepository implements IUserActivityRepository {
  constructor(
    @InjectModel(UserActivity.name, MONGODB_CONNECTION_NAME)
    private readonly model: Model<UserActivity>,
    private readonly clock: ClockService
  ) {}

  /**
   * Appends one activity.
   *
   * Errors propagate. Swallowing them is the recorder's job, not this one's —
   * keeping the repository honest means the E2E suite can assert that a
   * MongoDB failure is visible somewhere, and the unit tests can drive the
   * failure path directly.
   *
   * `createdAt` and `expiresAt` are both derived from a single `now` so the
   * retention window is exactly 30 days rather than 30 days plus however long
   * the two calls were apart.
   */
  async create(input: CreateUserActivityInput): Promise<void> {
    const now = this.clock.nowMs();

    await this.model.create({
      userId: input.userId,
      category: input.category,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      // Sanitized once more at the boundary: the recorder already screened
      // this, but the repository is the last thing before the write and should
      // not depend on its caller having done so.
      metadata: sanitizeMetadata(input.metadata ?? undefined) ?? null,
      createdAt: this.clock.dateFromMs(now),
      expiresAt: this.clock.addDaysFrom(now, ACTIVITY_RETENTION_DAYS)
    });
  }

  /**
   * One page of a single user's activities, newest first.
   *
   * `userId` is written into the query unconditionally and is not reachable
   * from anything the client sends, so a request cannot widen the result set
   * to another account.
   *
   * Returns up to `limit` documents; the use case asks for one more than the
   * page size to learn whether a next page exists without a count query.
   */
  async findForUser(
    filter: UserActivityQueryFilter
  ): Promise<UserActivityDocument[]> {
    // `mongoose`'s `FilterQuery` is not re-exported by this build's typings,
    // so the shape is spelled out here — as the audit repository does.
    const query: Record<string, unknown> = { userId: filter.userId };

    if (filter.category) {
      query.category = filter.category;
    }

    if (filter.cursor) {
      const createdAt = new Date(filter.cursor.createdAt);

      // Strictly after the cursor in (createdAt DESC, _id DESC) order.
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: filter.cursor.id } }
      ];
    }

    return this.model
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(filter.limit)
      .lean<UserActivityDocument[]>()
      .exec();
  }
}
