import { IS_PRODUCTION } from '@infrastructure/config/env/env.constants';
import { CookieOptions } from 'express';

/**
 * The authentication cookie policy, in one place.
 *
 * Both the writer (`AuthCookieService.set`, on login and refresh) and the
 * clearer (`ClearAuthCookiesInterceptor`, on logout) read from here. That
 * matters more than it looks: a browser only removes a cookie when the
 * clearing `Set-Cookie` carries the *same* `secure`/`sameSite`/`path`
 * attributes it was written with. Two hand-maintained copies drift, and the
 * symptom is a cookie that silently refuses to disappear.
 */

/** Cookies issued on login and rotated on refresh. */
export const AUTH_COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token'
} as const;

/** 15 minutes. Deliberate and matched by `jwt.config`'s access-token TTL. */
export const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

/** 7 days. Deliberate and matched by the refresh-token TTL. */
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Attributes shared by every auth cookie.
 *
 * `sameSite: 'strict'` in production is intentional. It assumes the frontend
 * and the API are same-site (same registrable domain — `app.example.com` and
 * `api.example.com` qualify); genuinely cross-site deployments would need
 * `'none'` plus `secure`, which is a deployment decision, not a default.
 */
export function baseAuthCookieOptions(): CookieOptions {
  return {
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'strict' : 'lax'
  };
}

/** Options for the two HttpOnly token cookies. */
export function tokenCookieOptions(maxAge: number): CookieOptions {
  return { ...baseAuthCookieOptions(), httpOnly: true, maxAge };
}

/**
 * Options for the CSRF cookie. Deliberately readable: the browser client has
 * to copy its value into the `X-CSRF-Token` header for the double-submit check.
 */
export function csrfCookieOptions(): CookieOptions {
  return { ...baseAuthCookieOptions(), httpOnly: false };
}
