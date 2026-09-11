export enum SessionErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_REUSE_DETECTED = 'SESSION_REUSE_DETECTED',
  REFRESH_RATE_LIMITED = 'REFRESH_RATE_LIMITED',
  /**
   * The presented token *was* the session's current one, but another request
   * rotated the session between the read and the compare-and-swap write. A
   * concurrency outcome, not a security one — see
   * `SessionErrors.refreshRotationConflict`.
   */
  REFRESH_ROTATION_CONFLICT = 'REFRESH_ROTATION_CONFLICT',
  INVALID_CURSOR = 'INVALID_CURSOR',
  /** The current session was addressed by id instead of through `DELETE /`. */
  SESSION_IS_CURRENT = 'SESSION_IS_CURRENT'
}
