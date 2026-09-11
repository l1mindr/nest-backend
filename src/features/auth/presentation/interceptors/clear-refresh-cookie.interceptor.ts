import { AppError } from '@core/errors/app.error';
import { SessionErrorCode } from '@features/sessions/domain/errors/session-error-code.enum';
import { TokenErrorCode } from '@features/token/errors/token-error-code.enum';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { catchError, Observable, throwError } from 'rxjs';
import {
  AUTH_COOKIE_NAMES,
  clearTokenCookieOptions
} from '../../application/services/auth-cookie.constants';

/**
 * Error codes that mean *this browser's refresh token is finished*.
 *
 * An allowlist rather than a denylist, deliberately. The failure modes of
 * `POST /v1/auth/refresh` are not a closed set — Redis, Postgres and the JWT
 * layer can all fail in ways that say nothing about the token's validity — and
 * the cost of the two mistakes is asymmetric. Clearing a live token logs a
 * legitimate user out for a blip on the server; keeping a dead one costs one
 * wasted round trip. So anything not named here keeps the cookie, and a new
 * terminal error has to be added here on purpose.
 *
 * Notably absent:
 *
 *  - `REFRESH_RATE_LIMITED` (429). The Redis refresh lock was already held, so
 *    the token was never examined. A legitimate client must be able to retry,
 *    and `test/v1/auth-refresh-v1.e2e-spec.ts` covers the concurrent-refresh
 *    race that produces it.
 *  - `REFRESH_ROTATION_CONFLICT` (409). The token *did* match the stored hash;
 *    another request simply committed its rotation first. The session is
 *    untouched and the retry needs this cookie to make — clearing it here would
 *    reintroduce the logout this code exists to prevent.
 *  - Anything mapped to 5xx. `ErrorMapper` turns an unrecognised throw into
 *    `INTERNAL_ERROR`, which is exactly the "server could not tell" case.
 */
const TERMINAL_REFRESH_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  // The JWT itself did not verify: tampered, wrong secret, wrong audience, or
  // past its own `exp`. `TokenVerificationService.verifyRefresh` collapses all
  // of those into INVALID_TOKEN; the other two are listed so a future split
  // between them does not silently stop clearing.
  TokenErrorCode.INVALID_TOKEN,
  TokenErrorCode.EXPIRED_TOKEN,
  TokenErrorCode.INVALID_REFRESH_TOKEN,
  // The JWT verified but no active session backs it. `findActive` filters on
  // both expiry and revocation, so a revoked session surfaces here too.
  SessionErrorCode.SESSION_EXPIRED,
  SessionErrorCode.SESSION_REVOKED,
  // Replay: the session has just been revoked by `Refresh`, so every token in
  // its lineage is dead — including the one the *legitimate* browser holds, if
  // it is the one that arrived second.
  SessionErrorCode.SESSION_REUSE_DETECTED
]);

function isTerminalRefreshFailure(error: unknown): boolean {
  return (
    error instanceof AppError && TERMINAL_REFRESH_ERROR_CODES.has(error.code)
  );
}

/**
 * Removes `refresh_token` from the browser when a refresh fails in a way that
 * proves the presented token can never work again.
 *
 * Without this, a browser holding an expired, revoked or replayed refresh token
 * kept it for the cookie's full 7 days. Nothing could authenticate with it —
 * `Refresh` re-checks the session every time — but the browser had no way to
 * learn that, so it re-sent the dead token on every 401 → refresh cycle and any
 * "am I logged in?" heuristic based on cookie presence answered yes for a
 * session that no longer existed. The same reasoning `ClearAuthCookiesInterceptor`
 * documents for logout, reached down the failure path instead of the success one.
 *
 * `catchError` re-throws after clearing: the response body is still
 * `GlobalExceptionFilter`'s to write, and the status and error code are
 * unchanged. The interceptor only appends a `Set-Cookie`, which is safe because
 * headers are not flushed until the filter writes the body.
 *
 * Only `refresh_token` is touched. `access_token` is the credential for the
 * request that triggered the refresh and is short-lived regardless, and
 * `csrf_token` is not a credential at all — clearing either here would widen a
 * failed refresh into a full logout, which is a decision for the client.
 */
@Injectable()
export class ClearRefreshCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      catchError((error: unknown) => {
        if (isTerminalRefreshFailure(error)) {
          // Built from the same policy source as the write, or the browser
          // treats this as a different cookie and keeps the original.
          res.clearCookie(
            AUTH_COOKIE_NAMES.REFRESH_TOKEN,
            clearTokenCookieOptions()
          );
        }

        return throwError(() => error);
      })
    );
  }
}
