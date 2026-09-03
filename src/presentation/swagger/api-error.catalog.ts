import { AppError } from '@core/errors/app.error';
import { DomainErrorCode } from '@core/errors/domain-error-code.enum';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { SecurityErrors } from '@features/security/errors/security-errors';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import { TokenErrors } from '@features/token/errors/token-errors';
import { HttpStatus } from '@nestjs/common';
import {
  ApiErrorExample,
  ApiErrorResponseOptions,
  errorExample
} from './api-response.decorator';

/**
 * Errors that any endpoint can raise, derived from the very factories the
 * runtime throws. Feature-specific errors are documented next to the endpoint
 * that produces them.
 */
export const CommonErrors = {
  authenticationRequired: errorExample(
    SecurityErrors.authenticationRequired(),
    'No access token cookie was sent'
  ),
  invalidToken: errorExample(
    TokenErrors.invalidToken(),
    'Access token is malformed, expired, or the account is no longer active'
  ),
  sessionExpired: errorExample(
    SessionErrors.sessionExpired(),
    'The session behind the token was revoked or has expired'
  ),
  accessDenied: errorExample(
    SecurityErrors.accessDenied(),
    'The authenticated user lacks the required role'
  ),
  invalidCsrfToken: errorExample(
    SecurityErrors.invalidCsrfToken(),
    'Missing or mismatched x-csrf-token header'
  ),
  rateLimitExceeded: errorExample(
    SecurityErrors.rateLimitExceeded(),
    'A request budget for this route is exhausted. Routes are limited on several identifiers at once (address, device, account); any one of them can trigger this'
  ),
  internalError: errorExample(
    new AppError(
      DomainErrorCode.INTERNAL_ERROR,
      ErrorDomain.SYSTEM,
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      'Unexpected error'
    ),
    'Unhandled exception; details are only written to the server log'
  )
} as const;

/**
 * Builds the example produced by the global `ValidationPipe`, which reports
 * the first failing constraint and the field it belongs to.
 */
export const validationError = (
  field: string,
  message: string
): ApiErrorExample =>
  errorExample(
    new AppError(
      DomainErrorCode.VALIDATION,
      ErrorDomain.VALIDATION,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field },
      message
    ),
    `\`${field}\` failed validation`
  );

/**
 * `401` for any endpoint behind `JwtGuard`. All three variants are reachable:
 * a missing cookie, an unusable token, and a session that no longer exists.
 */
export const unauthorizedResponse = (
  ...extra: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.UNAUTHORIZED,
  description:
    'Authentication failed. The `access_token` cookie is absent, unusable, or its session is gone. Obtain a new pair through `POST /v1/auth/refresh` or `POST /v1/auth/login`.',
  examples: [
    CommonErrors.authenticationRequired,
    CommonErrors.invalidToken,
    CommonErrors.sessionExpired,
    ...extra
  ]
});

/**
 * `401` for the public endpoints that reject credentials themselves instead of
 * going through `JwtGuard` — login and refresh. Their failure modes have
 * nothing to do with a missing `access_token` cookie, so the guard examples
 * would be misleading here.
 */
export const credentialsRejectedResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.UNAUTHORIZED,
  description,
  examples
});

/** `403` raised by a business rule rather than by `CsrfGuard` or `RolesGuard`. */
export const forbiddenResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.FORBIDDEN,
  description,
  examples
});

/** `403` for state-changing endpoints guarded by `CsrfGuard`. */
export const csrfForbiddenResponse = (
  ...extra: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.FORBIDDEN,
  description: `Double-submit CSRF check failed. Echo the \`csrf_token\` cookie back in the \`x-csrf-token\` header.`,
  examples: [CommonErrors.invalidCsrfToken, ...extra]
});

/** `403` for endpoints that additionally require a role. */
export const adminForbiddenResponse = (): ApiErrorResponseOptions => ({
  status: HttpStatus.FORBIDDEN,
  description:
    'The request was authenticated but rejected: the caller is not an administrator, or the CSRF check failed.',
  examples: [CommonErrors.accessDenied, CommonErrors.invalidCsrfToken]
});

/**
 * `400` for the errors raised before a handler runs — a malformed cursor, a
 * rejected verification code — as opposed to the `422` the `ValidationPipe`
 * produces for a well-formed body that breaks a constraint.
 */
export const badRequestResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.BAD_REQUEST,
  description,
  examples
});

/** `404` for endpoints addressing a resource that may not exist. */
export const notFoundResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.NOT_FOUND,
  description,
  examples
});

/** `409` for a request that conflicts with the resource's current state. */
export const conflictResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.CONFLICT,
  description,
  examples
});

/**
 * `410` for a resource that existed and has since lapsed. Distinguished from
 * `404` so a client can tell "this was never valid" from "this is no longer
 * valid" and offer the right recovery.
 */
export const goneResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.GONE,
  description,
  examples
});

/** `422` produced by the global `ValidationPipe` and by unique constraints. */
export const validationResponse = (
  description: string,
  examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.UNPROCESSABLE_ENTITY,
  description,
  examples
});

/** `502` for an endpoint whose upstream provider rejected the request or returned a malformed body. */
export const badGatewayResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.BAD_GATEWAY,
  description,
  examples
});

/** `504` for an endpoint whose upstream provider did not respond in time. */
export const gatewayTimeoutResponse = (
  description: string,
  ...examples: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.GATEWAY_TIMEOUT,
  description,
  examples
});

/** `429` for endpoints carrying a `@RateLimit` budget. */
export const rateLimitResponse = (
  description: string,
  ...extra: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.TOO_MANY_REQUESTS,
  description,
  examples: [CommonErrors.rateLimitExceeded, ...extra]
});

/** `500` — every endpoint can fail unexpectedly. */
export const internalServerErrorResponse = (
  ...extra: ApiErrorExample[]
): ApiErrorResponseOptions => ({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  description:
    'The request could not be completed because of an unexpected server-side failure.',
  examples: [CommonErrors.internalError, ...extra]
});
