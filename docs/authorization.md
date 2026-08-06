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

| Permission | Grants | Delegable |
|------------|--------|-----------|
| `USER_READ` | Read any user account and list the user directory. | yes |
| `USER_CREATE` | Create accounts on behalf of others. *Reserved.* | yes |
| `USER_UPDATE` | Edit the profile of any user account. | yes |
| `USER_DELETE` | Delete any user account. *Reserved.* | yes |
| `USER_SUSPEND` | Suspend a user account and revoke its sessions. | yes |
| `USER_UNSUSPEND` | Lift a suspension. | yes |
| `ADMIN_READ` | Read the administrator directory and per-administrator grants. | **no — owner** |
| `ADMIN_INVITE` | Invite administrators and revoke pending invitations. | **no — owner** |
| `ADMIN_UPDATE` | Edit another administrator's profile. | **no — owner** |
| `ADMIN_DELETE` | Delete an administrator account. | **no — owner** |
| `ADMIN_STATUS` | Activate, deactivate, suspend or unsuspend an administrator. | **no — owner** |
| `ROLE_ASSIGN` | Grant and revoke permissions on administrator accounts. | **no — owner** |
| `AUDIT_READ` | Read the audit trail. *Reserved.* | yes |
| `SYSTEM_SETTINGS` | Change system-wide settings. *Reserved.* | yes |

*Reserved* permissions are part of the model and seeded in the catalog, but no
route demands one yet. They exist so the endpoint that eventually needs one
arrives without a second round of migrations and grants.

The *Delegable* column is **policy, not data**: `PERMISSION_CATALOG`
(`src/features/authorization/domain/permission.catalog.ts`) carries an
`ownerOnly` flag per permission. The owner-only permissions can never be
granted — no grant row can name them and no DTO accepts them — so the routes
that declare them can only ever be reached by the owner, who bypasses
evaluation entirely. Administrator management is therefore owner-only with no
role check anywhere near a controller, and relaxing it later is one flag per
permission.

## Permission matrix

| Endpoint | Requirement |
|----------|-------------|
| `GET /v1/admin/users` | `USER_READ` |
| `GET /v1/admin/users/:id` | `USER_READ` |
| `POST /v1/admin/users/:id/suspend` | `USER_SUSPEND` |
| `PATCH /v1/admin/users/:id/unsuspend` | `USER_UNSUSPEND` |
| `GET /v1/admin/administrators` | `ADMIN_READ` (owner) |
| `GET /v1/admin/administrators/:id` | `ADMIN_READ` (owner) |
| `GET /v1/admin/administrators/me` | authenticated |
| `PATCH /v1/admin/administrators/:id` | `ADMIN_UPDATE` (owner) |
| `DELETE /v1/admin/administrators/:id` | `ADMIN_DELETE` (owner) |
| `POST /v1/admin/administrators/:id/activate` | `ADMIN_STATUS` (owner) |
| `POST /v1/admin/administrators/:id/deactivate` | `ADMIN_STATUS` (owner) |
| `POST /v1/admin/administrators/:id/suspend` | `ADMIN_STATUS` (owner) |
| `PATCH /v1/admin/administrators/:id/unsuspend` | `ADMIN_STATUS` (owner) |
| `POST /v1/admin/administrators/:id/permissions` | `ROLE_ASSIGN` (owner) |
| `DELETE /v1/admin/administrators/:id/permissions` | `ROLE_ASSIGN` (owner) |
| `POST /v1/admin/administrators/invitations` | `ADMIN_INVITE` (owner) |
| `GET /v1/admin/administrators/invitations` | `ADMIN_INVITE` (owner) |
| `DELETE /v1/admin/administrators/invitations/:id` | `ADMIN_INVITE` (owner) |
| `POST /v1/admin/administrators/invitations/accept` | public |
| `GET /v1/admin/permissions` | `ADMIN_READ` (owner) |
| `GET /v1/admin/permissions/me` | authenticated |

Every row still declares `@RequirePermissions(...)` exactly like a user-facing
route. "(owner)" only marks permissions whose catalog entry forbids delegation,
so no one but the owner can be evaluated against them — there is no separate
`@Roles(OWNER)` enforcement path. An administrator attempting any of these
routes is denied by the ordinary evaluation, which answers `403 ACCESS_DENIED`
with no metadata.

## Isolation and visibility

- `/v1/admin/users` serves the **ordinary user population only**. The queries
  behind it filter on `role = 'USER'`, so administrators and the owner never
  appear in listings, pagination or statistics and can never be addressed
  through user routes — resolving one answers `404` exactly as an identifier
  that was never issued.
- `/v1/admin/administrators` serves the **administrator population only** and
  is owner-reserved as a whole. An administrator cannot list, resolve, edit or
  suspend a peer; the only administrator they can address is themselves, via
  `/v1/admin/administrators/me`.
- The owner is excluded from every directory. Its only visibility of itself is
  through its own account endpoints, which behave like any other account's.
- Not knowing whether an identifier exists is the same not knowing whether it
  exists but is out of reach: one `404 USER_NOT_FOUND` for all three cases.

## Administrator invitations

Administrators are created by **invitation**, never by promoting an existing
account. The flow:

```
owner                            server                           invitee
  │ POST /administrators/invitations                              │
  │ { email, permissions }                                        │
  │  ──────────────────────────────────►                          │
  │    201 { id, email, status, expiresAt } (never the token)     │
  │                                                                │
  │                       email  [ accept-link?token=... ]        │
  │  ◄────────────────────────────────────────────────────────────│
  │                                                                │
  │                       POST /administrators/invitations/accept │
  │                        { token, username, password, name }    │
  │  ◄────────────────────────────────────────────────────────────│
  │                       204 (account created, ADMIN, ACTIVATE)  │
```

- The token is 32 bytes from a CSPRNG, sent only by email, and stored only as
  a SHA-256 digest — a database dump yields nothing that could be presented.
- An invitation is single-use, expires after 48 hours, and can be revoked by
  the owner while pending.
- Until acceptance, **no account exists**: a lapsed or revoked invitation
  leaves nothing that could be signed into. This is the property that made
  promotion untenable — a promotion-based design creates the privileged account
  up front, so a forgotten invitation leaves a dormant administrator behind.
- The accepted email comes from the invitation row, never from the request
  body, and the accept route is deliberately public — the token is the entire
  proof of entitlement. The response is a fixed `204` for an unknown, reused or
  revoked token (with the same `404`/`409`/`410` split as sign-in), so the
  endpoint does not confirm whether a given address was ever invited.
- Only delegable permissions can be named on an invitation; an owner-reserved
  permission is a validation error (`422`).

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
| Exactly one owner exists | partial unique index `uq_user_single_owner` on `user(role) WHERE role = 'OWNER'` |
| The owner cannot be created through the API | no endpoint accepts a role; `assertRoleAssignable` |
| The owner cannot be deleted | `assertDeletable`, called by `DeleteAccountUseCase` — refused even on the owner's own account |
| The owner cannot be suspended | `assertNotOwner`, called by `SuspendUserUseCase` |
| The owner cannot be demoted or edited | `assertNotOwner`, called via `loadManageableAdmin` |
| The owner cannot be administered | `assertNotSelf`, applied to every administrator-management route |

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
| Granting yourself a permission | `assertNotSelf` in `loadManageableAdmin` |
| Granting a permission you do not hold | `assertCanDelegate` |
| Disarming a more powerful colleague | `assertCanDelegate`, applied to revoke as well as grant |
| Creating a second owner | no role input, plus the unique index |
| Editing / suspending / deleting the owner | `OwnerProtectionPolicy` |
| Administrator minting administrators | owner-reserved permissions in `PERMISSION_CATALOG` — no one but the owner can be evaluated against them |
| Administrator inviting colleagues | `ADMIN_INVITE` is owner-only, same mechanism |
| Guest account taking over a lapsed invitation | no account exists until acceptance; tokens are single-use, expiring, revocable, hashed |

`ROLE_ASSIGN` on its own is not equivalent to every permission: a caller can
only pass on what they already hold. Without that limit, an administrator could
grant the rest to a colleague and have them grant those back. Owner-reserved
permissions additionally fail validation (`422`) before a use case runs, so
they can never be passed on at all.

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

```
admin_invitation
  id             uuid PK
  email          varchar              → must not belong to an existing account
  tokenHash      varchar(64)          → sha-256 digest, select: false
  permissions    varchar(64)[]        → delegable only
  expiresAt      timestamp            → 48 hours after issue
  acceptedAt     timestamp NULL
  revokedAt      timestamp NULL
  invitedById    uuid NULL            → user (SET NULL)
  acceptedUserId uuid NULL            → user (SET NULL)
  createdAt      timestamp

  UNIQUE (tokenHash)
  UNIQUE (email) WHERE acceptedAt IS NULL AND revokedAt IS NULL
```

Status is derived, not stored: a row is `PENDING` while both timestamps are
null, `ACCEPTED`/`REVOKED` by whichever settled it, and `EXPIRED` when
`expiresAt` has passed. The partial unique index allows re-inviting a lapsed
address only after its prior invitation settled, and the invite use case
supersedes any still-outstanding invitation for the address up front.

`permission` is reference data seeded by migration; the foreign key means a
grant can only ever name a permission the system knows about. `grantedById` is
retained so a privilege can be traced back to whoever handed it out.

The invitation holds the *digest* of its token, never the token itself, so the
table is safe to dump. An address that already has an account cannot be invited
at all, so acceptance can never collide with an existing login.

Adding a permission to an administrator is a data change. Adding a *new*
permission needs an enum member, a catalog description and a seed migration —
the code that requires it has to exist either way. An `ownerOnly: true` catalog
entry needs no migration at all.

## Extending later

Named custom admin roles (`SUPPORT_ADMIN` as a first-class role bundling
permissions) need an `admin_role` / `admin_role_permission` pair and one extra
branch in `PermissionEvaluationService`. Controllers, guards, decorators and use
cases are unaffected, because they speak in permissions.

A permission the owner wants to hand to administrators is one flag — `ownerOnly:
false` — in `PERMISSION_CATALOG`, plus (for one that is currently owner-only)
a grant. No route, guard or use case changes.

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
- `@Public()` bypasses `JwtGuard` but not `CsrfGuard`. The single exception is
  the invitation accept route, which carries `@SkipCsrf()`: its proof is a
  256-bit bearer token, a CSRF token would add nothing.
- Routes with no `@RequirePermissions` and no `@Roles` allow any authenticated
  caller.
