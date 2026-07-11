# API

This document describes the HTTP API implemented by the current controllers.

## API Versioning

URI versioning is enabled in [src/bootstrap.ts](../src/bootstrap.ts):

```ts
app.enableVersioning({
  type: VersioningType.URI
});
```

Current controllers use `version: '1'`, so routes are prefixed with `/v1`.

## Swagger

Swagger is configured only when `NODE_ENV === 'development'`.

Development URL:

```text
http://localhost:8080/api
```

Swagger decorators exist in:

- [src/features/auth/auth.swagger.ts](../src/features/auth/auth.swagger.ts)
- [src/features/users/users.swagger.ts](../src/features/users/users.swagger.ts)
- [src/features/sessions/sessions.swagger.ts](../src/features/sessions/sessions.swagger.ts)

Some Swagger response DTOs differ from the actual global error envelope. The runtime response format is determined by `DataResponseInterceptor` and `GlobalExceptionFilter`.

## Response Envelope

Successful responses are wrapped by [DataResponseInterceptor](../src/infrastructure/http/interceptors/data-response.interceptor.ts):

```json
{
  "data": {}
}
```

For `204 No Content` responses, Express/Nest does not send a body.

Errors are wrapped by [GlobalExceptionFilter](../src/features/security/filters/global-exception.filter.ts):

```json
{
  "error": {
    "code": "ERROR_CODE",
    "domain": "DOMAIN",
    "message": "Human-readable message",
    "meta": {},
    "path": "/v1/example",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

## Authentication Requirements

Routes are authenticated by default because `JwtGuard` is global. A route is public only if decorated with `@Public()`.

Unsafe methods require CSRF unless decorated with `@SkipCsrf()`:

- Send `csrf_token` cookie.
- Send matching `x-csrf-token` header.

## Auth Routes

Controller: [src/features/auth/auth.controller.ts](../src/features/auth/auth.controller.ts)

Base path: `/v1/auth`

| Method | Path | Status | Access | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/register` | `201` | Public, CSRF skipped, rate limited | Create a new user. |
| `POST` | `/login` | `200` | Public, CSRF skipped, rate limited | Authenticate by email or username and set auth cookies. |
| `POST` | `/refresh` | `200` | Public, CSRF required, rate limited | Rotate refresh token and set new auth cookies. |
| `POST` | `/change-password` | `204` | Authenticated, CSRF required, rate limited | Change password and revoke other sessions. |

### Register Request

DTO: [RegisterUserRequestDto](../src/features/auth/dto/request/register-user.request.dto.ts)

```json
{
  "email": "user@example.com",
  "username": "user_123",
  "password": "Password@123"
}
```

### Login Request

DTO: [LoginUserRequestDto](../src/features/auth/dto/request/login-user.request.dto.ts)

The `email` field accepts either email or username.

```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

### Change Password Request

DTO: [ChangePasswordRequestDto](../src/features/auth/dto/request/change-password.request.dto.ts)

```json
{
  "currentPassword": "Password@123",
  "newPassword": "NewPassword@123"
}
```

## User Routes

Controller: [src/features/users/users.controller.ts](../src/features/users/users.controller.ts)

Base path: `/v1/user`

| Method | Path | Status | Access | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/me` | `200` | Authenticated | Get current user's profile. |
| `PUT` | `/` | `204` | Authenticated, CSRF required | Update current user's profile. |
| `DELETE` | `/delete-account` | `204` | Authenticated, CSRF required | Soft-delete current account. |

### Profile Response

Response DTO: [UserProfileResponseDto](../src/features/users/dto/response/user-profile.response.dto.ts)

Exposed fields:

- `createdAt`
- `updatedAt`
- `deletedAt`
- `name`
- `username`
- `email`
- `role`
- `joinedAt`

`joinedAt` is transformed from `user.registryDates.createdAt`.

### Update Profile Request

DTO: [UpdateUserRequestDto](../src/features/users/dto/request/update-user.request.dto.ts)

This is a partial version of `CreateUserRequestDto` without `password`, so accepted fields are:

- `email`
- `username`
- `status`
- `name`

Current implementation allows profile update DTOs to include `status`; there is no controller-level role check on `PUT /v1/user`.

## Session Routes

Controller: [src/features/sessions/sessions.controller.ts](../src/features/sessions/sessions.controller.ts)

Base path: `/v1/sessions`

| Method | Path | Status | Access | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/` | `200` | Authenticated | List active sessions. |
| `DELETE` | `/` | `204` | Authenticated, CSRF required | Revoke current session. |
| `DELETE` | `/others` | `204` | Authenticated, CSRF required | Revoke other active sessions. |

Response DTO: [SessionResponseDto](../src/features/sessions/dto/response/session.response.dto.ts)

Exposed fields:

- `sessionId`
- `ipAddress`
- `deviceInfo`
- `validUntil`
- `lastActivityAt`
- `current`

## Admin User Routes

Controller: [src/features/users/admin.users.controller.ts](../src/features/users/admin.users.controller.ts)

Base path: `/v1/admin/users`

| Method | Path | Status | Access | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/` | `200` | `ADMIN` role | List users. |
| `GET` | `/:id` | `200` | `ADMIN` role | Get a user by UUID. |

`GET /:id` validates `id` using [IdDto](../src/infrastructure/http/dto/id.dto.ts).

## Validation Rules

Email fields:

- Use `class-validator` `IsEmail`.
- Trim and lowercase input.

Username fields:

- Trim and lowercase input.
- Must match `USERNAME_REGEX` from [src/core/validation/rules/username.rules.ts](../src/core/validation/rules/username.rules.ts).
- Length range: 3 to 30.
- Allows letters, numbers, dot, and underscore, with no leading/trailing dot and no consecutive dots.

Password fields:

- Must match `PASSWORD_REGEX` from [src/core/validation/rules/password.rules.ts](../src/core/validation/rules/password.rules.ts).
- Length range: 8 to 20.
- Requires lowercase, uppercase, digit, and a non-alphanumeric character.

## Current API Gaps

- No health, readiness, or metrics endpoints exist.
- No endpoint exists to clear auth cookies directly.
- No pagination exists on `GET /v1/admin/users`.
- No request DTO exists for query parameters on list endpoints.
- `ErrorResponseDto` exists for Swagger docs, but runtime errors use `GlobalExceptionFilter`'s `{ error: ... }` shape.
