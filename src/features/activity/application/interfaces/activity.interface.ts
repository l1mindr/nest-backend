import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import { ActivityAction } from '../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../domain/enums/activity-category.enum';

export type { PaginatedResult };

// ------------------------------------------------------------------ Cursor

/**
 * Pagination is on `(createdAt DESC, _id DESC)`.
 *
 * `createdAt` alone is not a stable sort key — two activities recorded in the
 * same millisecond would have an arbitrary order between pages, so an item
 * could be shown twice or skipped. `_id` breaks the tie, and because MongoDB
 * ObjectIds are monotonic within a millisecond it breaks it in insertion
 * order.
 *
 * The `_id` travels inside the cursor, but the cursor itself is base64url
 * (`@core/pagination/cursor.util`), so the id is never exposed as a bare
 * ObjectId in the API surface.
 */
export interface UserActivityCursor {
  createdAt: string;
  id: string;
}

// ------------------------------------------------------------------ Repository

/** What the repository is asked to write. `userId` is always the caller's. */
export interface CreateUserActivityInput {
  userId: string;
  category: ActivityCategory;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * A read filter.
 *
 * `userId` is required and has no "all users" value — the type is what makes
 * it impossible to express a cross-user query, so isolation does not depend on
 * every call site remembering to pass a filter.
 */
export interface UserActivityQueryFilter {
  userId: string;
  category?: ActivityCategory;
  cursor?: UserActivityCursor;
  limit: number;
}

/** A persisted activity, as the repository returns it. */
export interface UserActivityDocument {
  _id: string;
  userId: string;
  category: ActivityCategory;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  expiresAt: Date;
}

export const USER_ACTIVITY_REPOSITORY = Symbol('IUserActivityRepository');
export interface IUserActivityRepository {
  create(input: CreateUserActivityInput): Promise<void>;
  findForUser(filter: UserActivityQueryFilter): Promise<UserActivityDocument[]>;
}

// ------------------------------------------------------------------ Recorder

/** What a call site hands the recorder after its own operation succeeded. */
export interface RecordActivityInput {
  userId: string;
  category: ActivityCategory;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  /** Display-only, non-sensitive. Sanitized again before persistence. */
  metadata?: Record<string, unknown> | null;
}

export const USER_ACTIVITY_RECORDER = Symbol('IUserActivityRecorder');
export interface IUserActivityRecorder {
  /**
   * Records an activity. Never throws and never rejects: activity is
   * user-facing telemetry, and a business operation that already succeeded
   * must not be reported as failed because this write did not land.
   */
  record(input: RecordActivityInput): void;
}

// ------------------------------------------------------------------ Read model

/** One activity as the API returns it. */
export interface UserActivityItem {
  id: string;
  category: ActivityCategory;
  action: ActivityAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListUserActivitiesQuery {
  cursor?: string;
  limit?: number;
  category?: ActivityCategory;
}

export const LIST_USER_ACTIVITIES_USE_CASE = Symbol(
  'IListUserActivitiesUseCase'
);
export interface IListUserActivitiesUseCase {
  /**
   * `userId` is a separate argument rather than part of `query` so it cannot
   * be populated from request query parameters by mistake — the controller has
   * to pass the authenticated principal explicitly.
   */
  execute(
    userId: string,
    query: ListUserActivitiesQuery
  ): Promise<PaginatedResult<UserActivityItem>>;
}
