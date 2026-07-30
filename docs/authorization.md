# Authorization

## Overview

Role-based access control using a global `RolesGuard` with `@Roles()` decorator metadata.

## Guards

### JwtGuard (Global)

Every request requires a valid `access_token` cookie unless the route is marked `@Public()`.

- Extracts token from cookies
- Verifies JWT signature
- Validates payload against database (user exists, session active)
- Attaches `req.user` and `req.session`

### RolesGuard (Global)

Reads `@Roles()` metadata from the controller class or method.

- No `@Roles()` → allows all authenticated users through
- `@Roles(UserRole.ADMIN)` → restricts to admin users only
- Role is loaded from database (not from JWT claims)

## Roles

| Role | Enum Value | Default For |
|------|-----------|-------------|
| User | `USER` | All registered users |
| Admin | `ADMIN` | Manually promoted users |

## Decorators

| Decorator | Target | Effect |
|-----------|--------|--------|
| `@Roles(...)` | Controller/Route | Restricts access to specified roles |
| `@Public()` | Route | Bypasses JwtGuard (no authentication required) |
| `@User()` | Param | Injects `AuthUser` from request (id, role) |
| `@Session()` | Param | Injects `AuthSession` from request (id) |

## Admin Endpoints

Protected by `@UseGuards(RolesGuard)` + `@Roles(UserRole.ADMIN)` on the controller:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/admin/users` | List users (paginated) |
| `GET` | `/v1/admin/users/:id` | Get user by ID |
| `POST` | `/v1/admin/users/:id/suspend` | Suspend user |
| `PATCH` | `/v1/admin/users/:id/unsuspend` | Unsuspend user |

Non-admin users receive `403 ACCESS_DENIED`.

## Auth Context

Available on `request` after JwtGuard executes:

```typescript
interface AuthUser {
  readonly id: string;
  readonly role: UserRole;
}

interface AuthSession {
  readonly id: string;
}
```

## Security Notes

- Role is loaded from database on every request (not from JWT) — immediate role change propagation
- `@Public()` bypasses JwtGuard but not CsrfGuard
- Routes with no `@Roles()` metadata allow all authenticated users (not just USER role)
