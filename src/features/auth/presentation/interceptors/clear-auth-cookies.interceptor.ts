import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  AUTH_COOKIE_NAMES,
  clearTokenCookieOptions,
  csrfCookieOptions
} from '../../application/services/auth-cookie.constants';

/**
 * Clears every authentication cookie once the handler has succeeded.
 *
 * Used by `DELETE /v1/sessions` (logout). It replaces the narrower
 * `ClearCsrfCookieInterceptor`, which removed only `csrf_token` and left
 * `access_token` and `refresh_token` in the browser until they expired — up to
 * 15 minutes and 7 days respectively.
 *
 * That was not an access-control hole: `TokenValidationService` re-checks that
 * the session is still active on every request, so the leftover cookies
 * authenticated nothing. It was a correctness and clarity problem. The browser
 * kept presenting dead credentials, so each subsequent request paid a full
 * 401 → refresh → 401 round trip before the client concluded the session was
 * gone, and any "am I logged in?" check based on cookie presence answered yes
 * for a session that no longer existed.
 *
 * `tap` rather than `map`: the cookies are cleared only when the revocation
 * itself succeeded. A failed logout must not leave the browser without
 * credentials for a session that is still alive on the server.
 */
@Injectable()
export class ClearAuthCookiesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // Attributes must match those the cookies were written with, or the
        // browser treats this as a different cookie and keeps the original.
        res.clearCookie(
          AUTH_COOKIE_NAMES.ACCESS_TOKEN,
          clearTokenCookieOptions()
        );

        res.clearCookie(
          AUTH_COOKIE_NAMES.REFRESH_TOKEN,
          clearTokenCookieOptions()
        );

        res.clearCookie(AUTH_COOKIE_NAMES.CSRF_TOKEN, csrfCookieOptions());
      })
    );
  }
}
