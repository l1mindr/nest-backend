/**
 * The user-facing grouping an activity belongs to.
 *
 * Stored separately from {@link ActivityAction} so that "what kind of thing
 * happened" and "what happened to it" stay independent: the UI can filter on a
 * category without parsing a compound string, translations are written once per
 * part rather than once per combination, and a new action can be added to a
 * category without inventing a new identifier for the pair.
 *
 * Deliberately not the same vocabulary as `AuditAction`. Audit logs are an
 * internal security and diagnostic record; these categories exist only to
 * organise a screen a user reads about their own account.
 */
export enum ActivityCategory {
  /** Sign-in, sign-out, password and session changes. */
  SECURITY = 'SECURITY',
  PORTFOLIO = 'PORTFOLIO',
  TRANSACTION = 'TRANSACTION',
  PRICE_ALERT = 'PRICE_ALERT',
  /** Profile and preference changes. */
  ACCOUNT = 'ACCOUNT'
}
