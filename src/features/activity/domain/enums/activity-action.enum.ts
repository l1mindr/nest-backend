/**
 * What the user did, within their {@link ActivityCategory}.
 *
 * The generic verbs (`CREATED`, `UPDATED`, `DELETED`) are shared across
 * categories on purpose — a created portfolio and a created transaction are the
 * same verb applied to different nouns, and pairing them with the category is
 * what makes the record specific. The verbs that only make sense in one place
 * (`LOGIN`, `PROFILE_UPDATED`) are named for that place.
 *
 * Which verbs are legal in which category is not expressible in an enum, so it
 * is stated once in `ACTIVITY_CATALOG` and enforced by the recorder.
 */
export enum ActivityAction {
  // SECURITY
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',

  // PORTFOLIO, TRANSACTION, PRICE_ALERT
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',

  // PRICE_ALERT
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',

  // ACCOUNT
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED'
}
