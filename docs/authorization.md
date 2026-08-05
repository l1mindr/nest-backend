# Authorization

## Overview

Access is decided by **permissions**, not by roles. A route declares the
permission it needs; the caller either holds it or does not. Roles exist only to
express the three tiers of the system, and only one of them — the owner — short
-circuits the question.

```
request
   │
   ▼
JwtGuard          authenticates, attaches req.user { id, role }
   │
   ▼
RateLimitGuard
   │
   ▼
RolesGuard        only for routes reserved to a tier outright (@Roles)
   │
   ▼
PermissionGuard   reads @RequirePermissions, asks the evaluation service
   │
   ▼
CsrfGuard
   │
   ▼
handler
```

The decision itself lives in one place, `PermissionEvaluationService`:

```
owner?  ──────────────────────────────► allow, no lookup
   │ no
   ▼
load the grants held by this account
   │
   ▼
does the account hold every required permission?  ──► allow / deny
```

Roles below administrator hold no grants, so they fall out of the same
evaluation as denied. There is no per-role branch to update when a tier is
added.

## Role hierarchy

| Role    | Rank | Meaning |
|---------|------|---------|
| `OWNER` | 30   | Exactly one exists. Bypasses every authorization check. |
| `ADMIN` | 20   | Reaches only what has been granted. Holding the role alone grants nothing. |
| `USER`  | 10   | Reaches only its own resources. Unchanged from before. |

`RoleHierarchy.satisfies` compares by **rank, not equality**, so `@Roles(ADMIN)`
is also satisfied by the owner. "The owner can do everything" is stated once, in
the hierarchy, rather than at every call site.

A future `SUPPORT_ADMIN` is a new member at rank 20 whose reach is decided
entirely by the permissions granted to it. No controller changes.

## Permissions

`Permission` (`src/features/authorization/domain/enums/permission.enum.ts`) is
the single source of truth. `PERMISSION_CATALOG` is typed
`Record<Permission, string>`, so adding a member without describing it is a
compile error.

| Permission | Grants |
|------------|--------|
| `USER_READ` | Read any user account and list the directory. |
| `USER_CREATE` | Create accounts on behalf of others. *Reserved.* |
| `USER_UPDATE` | Edit the profile of any user account. |
| `USER_DELETE` | Delete any user account. *Reserved.* |
| `USER_SUSPEND` | Suspend a user account and revoke its sessions. |
| `USER_UNSUSPEND` | Lift a suspension. |
| `ADMIN_READ` | Read the administrator directory and the permission catalog. |
| `ADMIN_UPDATE` | Edit another administrator's profile. |
| `ROLE_ASSIGN` | Grant and revoke permissions on other administrators. |
| `AUDIT_READ` | Read the audit trail. *Reserved.* |
| `SYSTEM_SETTINGS` | Change system-wide settings. *Reserved.* |

*Reserved* permissions are part of the model and seeded in the catalog, but no
route demands one yet. They exist so the endpoint that eventually needs one
arrives without a second round of migrations and grants.

## Permission matrix

| Endpoint | Requirement |
|----------|-------------|
| `GET /v1/admin/users` | `USER_READ` |
| `GET /v1/admin/users/:id` | `USER_READ` |
| `POST /v1/admin/users/:id/suspend` | `USER_SUSPEND` |
| `PATCH /v1/admin/users/:id/unsuspend` | `USER_UNSUSPEND` |
| `GET /v1/admin/admins` | `ADMIN_READ` |
| `GET /v1/admin/admins/:id` | `ADMIN_READ` |
| `PATCH /v1/admin/admins/:id` | `ADMIN_UPDATE` |
| `POST /v1/admin/admins/:id/permissions` | `ROLE_ASSIGN` |
| `DELETE /v1/admin/admins/:id/permissions` | `ROLE_ASSIGN` |
| `GET /v1/admin/permissions` | `ADMIN_READ` |
| `GET /v1/admin/permissions/me` | authenticated |
| `POST /v1/admin/admins` | **owner only** |
| `DELETE /v1/admin/admins/:id` | **owner only** |
| `POST /v1/admin/admins/:id/activate` | **owner only** |
| `POST /v1/admin/admins/:id/deactivate` | **owner only** |
| `POST /v1/admin/admins/:id/suspend` | **owner only** |
| `PATCH /v1/admin/admins/:id/unsuspend` | **owner only** |

The lifecycle of an administrator is reserved to the owner by role rather than
by permission. An administrator able to create or unmake administrators would
hold every permission by proxy.

## Administrator archetypes

These are descriptions of a grant set, not types in the schema:

| Archetype | Permissions |
|-----------|-------------|
| Read-only | `USER_READ` |
| Support   | `USER_READ`, `USER_UPDATE` |
| Moderator | `USER_READ`, `USER_SUSPEND` |
| Super     | every permission — still below the owner |

## Owner invariants

Enforced by `OwnerProtectionPolicy`, and independently by the database.

| Invariant | Enforced by |
|-----------|-------------|
| Exactly one owner exists | partial unique index `uq_user_single_owner` on `user(role) WHERE role = 'OWNER'`, plus `loadPromotableUser` |
| The owner cannot be created through the API | no endpoint accepts a role; `assertRoleAssignable` |
| The owner cannot be deleted | `assertDeletable`, called by `DeleteAccountUseCase` — refused even on the owner's own account |
| The owner cannot be suspended | `assertNotOwner`, called by `SuspendUserUseCase` |
| The owner cannot lose the role | `assertNotOwner`, called via `loadManageableAdmin` |
| The owner cannot be edited by others | `assertNotOwner`, called by `UpdateAdminUseCase` |

The owner remains an ordinary account **to themselves**: password reset, profile
update and email verification behave exactly as for any user.

## Decorators

| Decorator | Target | Effect |
|-----------|--------|--------|
| `@RequirePermissions(...)` | Controller/Route | Requires **all** listed permissions. Owner bypasses. |
| `@Roles(...)` | Controller/Route | Requires a role tier or above. Reserved for owner-only routes. |
| `@Public()` | Route | Bypasses `JwtGuard`. |
| `@User()` | Param | Injects `AuthUser` from the request. |
| `@Session()` | Param | Injects `AuthSession` from the request. |

Requirements are **conjunctive**: `@RequirePermissions(A, B)` demands both. A
route-level declaration overrides a class-level one rather than adding to it.

## Preventing escalation

| Attack | Blocked by |
|--------|------------|
| Self-promotion | `assertNotSelf` in `loadPromotableUser` |
| Granting yourself a permission | `assertNotSelf` in `loadManageableAdmin` |
| Granting a permission you do not hold | `assertCanDelegate` |
| Disarming a more powerful colleague | `assertCanDelegate`, applied to revoke as well as grant |
| Creating a second owner | no role input, plus the unique index |
| Editing / suspending / deleting the owner | `OwnerProtectionPolicy` |
| Administrator minting administrators | `@Roles(OWNER)` on the lifecycle routes |

`ROLE_ASSIGN` on its own is not equivalent to every permission: a caller can
only pass on what they already hold. Without that limit, an administrator could
grant the rest to a colleague and have them grant those back.

## Freshness

Grants are read **per request** and never carried in the access token, so a
revocation takes effect on the target's very next request rather than at the
next token rotation. The lookup only happens on routes that declare a
requirement, so the ordinary authenticated path pays nothing for it.

Demotion and deactivation additionally revoke all sessions, because an access
token issued earlier carries the old role.

## Persistence

```
user                          permission
  id        uuid PK             code        varchar(64) PK
  role      user_role_enum      description varchar(255)
  ...
        ▲                            ▲
        │ userId (CASCADE)           │ permission (RESTRICT)
        │                            │
        └──────  admin_permission  ──┘
                   id          uuid PK
                   userId      uuid
                   permission  varchar(64)
                   grantedById uuid NULL (SET NULL)
                   grantedAt   timestamp
                   UNIQUE (userId, permission)
```

`permission` is reference data seeded by migration; the foreign key means a
grant can only ever name a permission the system knows about. `grantedById` is
retained so a privilege can be traced back to whoever handed it out.

Adding a permission to an administrator is a data change. Adding a *new*
permission needs an enum member, a catalog description and a seed migration —
the code that requires it has to exist either way.

## Extending later

Named custom admin roles (`SUPPORT_ADMIN` as a first-class role bundling
permissions) need an `admin_role` / `admin_role_permission` pair and one extra
branch in `PermissionEvaluationService`. Controllers, guards, decorators and use
cases are unaffected, because they speak in permissions.

## Bootstrapping the owner

No migration creates an owner: it would need credentials, and a fabricated row
with a placeholder password is a default-credential liability. Promote a real,
verified account instead:

```sql
UPDATE "user" SET role = 'OWNER'
WHERE email = 'owner@example.com' AND status = 'ACTIVATE';
```

The unique index guarantees this can only succeed once.

## Security notes

- Role and grants are read from the database on every request, never from JWT
  claims — immediate propagation of any change.
- `403 ACCESS_DENIED` carries no metadata: which permission was missing belongs
  in the logs, not in a response an attacker can read.
- Grant and revoke are idempotent, so replaying a request is never an error.
- `@Public()` bypasses `JwtGuard` but not `CsrfGuard`.
- Routes with no `@RequirePermissions` and no `@Roles` allow any authenticated
  caller.
