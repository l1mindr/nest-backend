import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ActivityAction } from '../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../domain/enums/activity-category.enum';

/**
 * A user-facing activity record.
 *
 * Stored in its own collection, on the existing `logs` connection. It shares
 * the connection with `audit_logs` and nothing else: the two have different
 * audiences (a user reading their own history vs. an operator investigating an
 * incident), different vocabularies, and different lifetimes — audit logs are
 * kept, these expire after 30 days.
 */
@Schema({
  collection: 'user_activities',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false
})
export class UserActivity extends Document {
  @Prop({ required: true, type: String })
  userId: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ActivityCategory)
  })
  category: ActivityCategory;

  @Prop({ required: true, type: String, enum: Object.values(ActivityAction) })
  action: ActivityAction;

  @Prop({ required: false, type: String, default: null })
  entityType?: string | null;

  @Prop({ required: false, type: String, default: null })
  entityId?: string | null;

  /** Display-only. Sanitized before it reaches this document. */
  @Prop({ required: false, type: Object, default: null })
  metadata?: Record<string, unknown> | null;

  @Prop({ required: true, type: Date })
  createdAt: Date;

  /** `createdAt + ACTIVITY_RETENTION_DAYS`. Drives the TTL index below. */
  @Prop({ required: true, type: Date })
  expiresAt: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);

/**
 * The only read path: one user's activities, newest first.
 *
 * A category filter rides along as a predicate on the scanned range rather
 * than getting its own index — a user's 30-day window is small enough that
 * narrowing by `userId` has already done the work, and a third index would
 * cost every write to save nothing measurable on the read.
 */
UserActivitySchema.index({ userId: 1, createdAt: -1 });

/**
 * Retention, enforced by MongoDB rather than by us.
 *
 * `expireAfterSeconds: 0` means "delete when `expiresAt` is in the past" — the
 * field carries the deadline, so the window can be changed for future records
 * without touching the index. The background TTL monitor runs about once a
 * minute, so deletion is prompt but not instantaneous; nothing in the API
 * depends on the exact moment a record disappears.
 *
 * There is no cron job, and there should not be one: a scheduled deletion in
 * application code only runs when the application does, and would silently
 * stop enforcing the policy the moment a deployment was paused.
 */
UserActivitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
