import { ActivityAction } from './enums/activity-action.enum';
import { ActivityCategory } from './enums/activity-category.enum';

/**
 * How long a user activity is kept before MongoDB removes it.
 *
 * Enforced by a TTL index on `expiresAt`, not by application code — see
 * `user-activity.schema.ts`. There is deliberately no cron job: the retention
 * window is a property of the collection, so it holds even when the
 * application is not running.
 */
export const ACTIVITY_RETENTION_DAYS = 30;

/**
 * The actions each category accepts.
 *
 * The pair is the unit of meaning — `{ TRANSACTION, CREATED }` is a record,
 * `{ TRANSACTION, LOGIN }` is a bug — so the legal combinations are stated in
 * one place and checked before anything is written. Without this, a typo in a
 * call site would persist a row that no UI knows how to render and no filter
 * would ever surface.
 */
export const ACTIVITY_CATALOG: Readonly<
  Record<ActivityCategory, readonly ActivityAction[]>
> = {
  [ActivityCategory.SECURITY]: [
    ActivityAction.LOGIN,
    ActivityAction.LOGOUT,
    ActivityAction.PASSWORD_CHANGED,
    ActivityAction.SESSION_CREATED,
    ActivityAction.SESSION_REVOKED
  ],
  [ActivityCategory.PORTFOLIO]: [
    ActivityAction.CREATED,
    ActivityAction.UPDATED,
    ActivityAction.DELETED
  ],
  [ActivityCategory.TRANSACTION]: [
    ActivityAction.CREATED,
    ActivityAction.UPDATED,
    ActivityAction.DELETED
  ],
  [ActivityCategory.PRICE_ALERT]: [
    ActivityAction.CREATED,
    ActivityAction.UPDATED,
    ActivityAction.DELETED,
    ActivityAction.ENABLED,
    ActivityAction.DISABLED
  ],
  [ActivityCategory.ACCOUNT]: [
    ActivityAction.PROFILE_UPDATED,
    ActivityAction.SETTINGS_UPDATED
  ]
} as const;

/** True when `action` is one the `category` is allowed to carry. */
export function isValidActivityPair(
  category: ActivityCategory,
  action: ActivityAction
): boolean {
  return ACTIVITY_CATALOG[category]?.includes(action) ?? false;
}

/**
 * The entity a category's records point at, used when a call site does not
 * name one itself. Keeps `entityType` consistent across call sites rather than
 * leaving each to spell its own string.
 */
export const ACTIVITY_DEFAULT_ENTITY_TYPE: Readonly<
  Record<ActivityCategory, string | null>
> = {
  [ActivityCategory.SECURITY]: null,
  [ActivityCategory.PORTFOLIO]: 'PORTFOLIO',
  [ActivityCategory.TRANSACTION]: 'TRANSACTION',
  [ActivityCategory.PRICE_ALERT]: 'PRICE_ALERT',
  [ActivityCategory.ACCOUNT]: null
} as const;
