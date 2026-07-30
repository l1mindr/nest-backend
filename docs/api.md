# API

## Versioning

URI-based versioning via `app.enableVersioning()`. All routes use `version: '1'` → prefixed `/v1`.

## Response Envelope

### Success

```json
{
  "data": { ... }
}
```

Wrapped by `DataResponseInterceptor` (global).

### Error

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "domain": "USER",
    "message": "User not found",
    "meta": { "userId": "..." },
    "path": "/v1/admin/users/...",
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}
```

Formatted by `GlobalExceptionFilter`.

---

## Authentication

All routes authenticated by default (`JwtGuard` is global). Use `@Public()` to opt out.

| Method | Path | Auth | CSRF | Rate Limit | Status |
|--------|------|------|------|------------|--------|
| `POST` | `/v1/auth/register` | Public | Skipped | 5/60s | 201 |
| `POST` | `/v1/auth/login` | Public | Skipped | 5/60s | 200 |
| `POST` | `/v1/auth/refresh` | Public | Required | 20/60s | 200 |
| `POST` | `/v1/auth/change-password` | Authenticated | Required | 3/300s | 204 |

### POST /v1/auth/register

Request:
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "Secure@123"
}
```

Response: `201 No Content`

Errors: `409 EMAIL_ALREADY_EXISTS`, `409 USERNAME_ALREADY_EXISTS`, `422 Validation`

### POST /v1/auth/login

Request:
```json
{
  "identifier": "user@example.com",
  "password": "Secure@123"
}
```

Response: `200 OK` — Sets `access_token`, `refresh_token`, `csrf_token` cookies
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "role": "USER"
  }
}
```

Errors: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_NOT_VERIFIED`, `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_DEACTIVATED`

### POST /v1/auth/refresh

Request: No body. Uses `refresh_token` cookie + `X-CSRF-Token` header.

Response: `200 OK` — Rotates both tokens, sets new cookies.

Errors: `401 TOKEN_EXPIRED`, `401 TOKEN_INVALID`, `401 SESSION_REUSE_DETECTED`, `429 REFRESH_RATE_LIMITED`

### POST /v1/auth/change-password

Request:
```json
{
  "currentPassword": "Old@123",
  "newPassword": "New@456"
}
```

Response: `204 No Content`

---

## Users

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/user/me` | Authenticated | - | Get current user profile |
| `PUT` | `/v1/user` | Authenticated | Required | Update profile |
| `DELETE` | `/v1/user/delete-account` | Authenticated | Required | Soft delete account |

### GET /v1/user/me

Response: `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "name": "John Doe",
    "role": "USER",
    "status": "ACTIVATE",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### PUT /v1/user

Request:
```json
{
  "name": "John Updated",
  "username": "john_updated",
  "email": "updated@example.com"
}
```

Response: `204 No Content`

---

## Sessions

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/sessions` | Authenticated | - | List active sessions (cursor-paginated) |
| `DELETE` | `/v1/sessions` | Authenticated | Required | Revoke current session (logout) |
| `DELETE` | `/v1/sessions/others` | Authenticated | Required | Revoke all other sessions |

### GET /v1/sessions

Query params: `cursor`, `limit` (default: 10)

Response: `200 OK`
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "device": { "browserName": "Chrome", "osName": "macOS", "deviceType": "desktop" },
        "ipAddress": "::1",
        "isCurrent": true,
        "lastUsedAt": "...",
        "createdAt": "..."
      }
    ],
    "currentSession": { "id": "uuid" },
    "nextCursor": "base64string"
  }
}
```

### DELETE /v1/sessions

Response: `204 No Content`

---

## Admin Users

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/admin/users` | Admin | - | List users (cursor-paginated) |
| `GET` | `/v1/admin/users/:id` | Admin | - | Get user by ID |
| `POST` | `/v1/admin/users/:id/suspend` | Admin | Required | Suspend user |
| `PATCH` | `/v1/admin/users/:id/unsuspend` | Admin | Required | Unsuspend user |

### GET /v1/admin/users

Query params: `cursor`, `limit`

Response: `200 OK`
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "username": "john_doe",
        "role": "USER",
        "status": "ACTIVATE",
        "createdAt": "...",
        "updatedAt": "...",
        "deleteAt": null
      }
    ],
    "nextCursor": "base64string"
  }
}
```

### POST /v1/admin/users/:id/suspend

Request:
```json
{
  "reason": "Violation of terms of service"
}
```

Response: `204 No Content`

### PATCH /v1/admin/users/:id/unsuspend

Request: No body

Response: `204 No Content`

Errors: `404 USER_NOT_FOUND`, `409 INVALID_STATUS_TRANSITION`

---

## Swagger

Available in development mode at `http://localhost:8080/api`.

Swagger decorators are defined in each feature's `presentation/swagger/` directory.

---

## Validation Rules

| Field | Rules |
|-------|-------|
| Email | `IsEmail()`, trimmed, lowercased |
| Username | 3–30 chars, regex `[a-zA-Z0-9._]`, no leading/trailing dots, no consecutive dots, trimmed, lowercased |
| Password | 8–20 chars, requires lowercase + uppercase + digit + non-alphanumeric |
| ID | UUID v4 |

Validation errors return `422 UNPROCESSABLE ENTITY` with `VALIDATION_ERROR` domain.

---

## Cookies

| Cookie | Type | HTTP-only | SameSite | Description |
|--------|------|-----------|----------|-------------|
| `access_token` | JWT | Yes | Lax | Bearer token for API access (15 min) |
| `refresh_token` | JWT | Yes | Lax | Token for refresh (7 days) |
| `csrf_token` | Hex | No | Lax | CSRF double-submit token |
