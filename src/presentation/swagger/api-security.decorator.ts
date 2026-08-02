import { ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';
import { SecurityScheme } from './openapi.constants';

/**
 * Marks an operation as requiring the `access_token` cookie.
 *
 * `JwtGuard` is registered globally, so every route is authenticated unless it
 * carries `@Public()`. Applying this per operation — rather than declaring a
 * global security requirement — keeps the public auth endpoints free of a
 * requirement they do not have.
 */
export const ApiAuthenticated = () =>
  ApiCookieAuth(SecurityScheme.ACCESS_TOKEN);

/** Marks an operation as consuming the `refresh_token` cookie. */
export const ApiRefreshTokenAuth = () =>
  ApiCookieAuth(SecurityScheme.REFRESH_TOKEN);

/**
 * Marks a state-changing operation as subject to the double-submit CSRF check
 * enforced by `CsrfGuard`. Safe methods and `@SkipCsrf()` routes are exempt.
 *
 * CSRF-protected routes always run behind `JwtGuard` as well — a CSRF token is
 * bound to an authenticated session — so this decorator emits a **single**
 * security requirement object carrying both the `access_token` cookie and the
 * `x-csrf-token` header. Inside one object the two are ANDed, which matches the
 * runtime: emitting them as separate requirements would wrongly allow either
 * one alone.
 */
export const ApiCsrfProtected = () =>
  ApiSecurity({
    [SecurityScheme.ACCESS_TOKEN]: [],
    [SecurityScheme.CSRF_TOKEN]: []
  });
