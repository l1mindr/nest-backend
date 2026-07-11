# Entities and DTOs

This document describes persisted entities, embedded data, and important request/response DTOs.

## User Entity

File: [src/features/users/entities/user.entity.ts](../src/features/users/entities/user.entity.ts)

The `User` entity represents an account.

| Property | Decorators / Type | Notes |
| --- | --- | --- |
| `id` | `@PrimaryGeneratedColumn('uuid')` | Primary key. |
| `name` | `@Column({ length: 50, nullable: true, select: false })` | Optional display name, excluded by default queries. |
| `email` | `@Column({ unique: true })` | Unique email. |
| `username` | `@Column({ unique: true, length: 30 })` | Unique username. |
| `password` | `@Column({ select: false })` | Password hash, excluded by default queries. |
| `status` | enum `UserStatus` | Defaults to `DEACTIVATE`. |
| `role` | enum `UserRole` | Defaults to `USER`. |
| `registryDates` | embedded `RegistryDatesOrm` | `createdAt`, `updatedAt`, `deleteAt`. |
| `sessions` | `@OneToMany(() => Session)` | Cascades soft-remove and recover. |
| `isDeleted` | getter | Returns `!!registryDates.deleteAt`. |

Unique constraints:

- `users_email_unique`
- `users_username_unique`

Enums:

- [UserRole](../src/features/users/enums/user-role.enum.ts): `ADMIN`, `USER`.
- [UserStatus](../src/features/users/enums/user-status.enum.ts): `ACTIVATE`, `DEACTIVATE`, `SUSPEND`.

Current note: `status` is stored and exposed in admin responses, but the authentication flow does not enforce status values.

## Session Entity

File: [src/features/sessions/entities/session.entity.ts](../src/features/sessions/entities/session.entity.ts)

The `Session` entity tracks a login session and refresh-token state.

| Property | Decorators / Type | Notes |
| --- | --- | --- |
| `id` | `@PrimaryGeneratedColumn('uuid')` | Primary key. |
| `refreshTokenHash` | `@Column()` | Hash of current refresh token. |
| `device` | `@Column({ type: 'jsonb' })` | `ISessionDevice`. |
| `ipAddress` | `@Column()` | IP at login. |
| `isRevoked` | `@Column({ default: false })` | Revocation flag. |
| `expiresAt` | timestamp column | Session expiry. |
| `lastUsedAt` | timestamp column | Last activity. |
| `version` | `@Column({ default: 0 })` | Refresh rotation version. |
| `rotatedAt` | nullable timestamp | Latest rotation. |
| `createdAt` | `@CreateDateColumn()` | Created timestamp. |
| `updatedAt` | `@UpdateDateColumn()` | Updated timestamp. |
| `owner` | `@ManyToOne(() => User)` | Required owner relation. |

## Embedded Timestamp Data

Files:

- [src/core/registry-dates.ts](../src/core/registry-dates.ts)
- [src/infrastructure/databases/postgres/embedded/registry-dates.embedded.ts](../src/infrastructure/databases/postgres/embedded/registry-dates.embedded.ts)

`RegistryDatesOrm` extends `RegistryDates` and maps:

- `createdAt` through `@CreateDateColumn()`.
- `updatedAt` through `@UpdateDateColumn()`.
- `deleteAt` through `@DeleteDateColumn()`.

`User` embeds these dates with `prefix: false`, so columns are stored directly on the `user` table.

## Request DTOs

### Auth DTOs

- [RegisterUserRequestDto](../src/features/auth/dto/request/register-user.request.dto.ts): `email`, `username`, `password`.
- [LoginUserRequestDto](../src/features/auth/dto/request/login-user.request.dto.ts): `email` or username, `password`.
- [ChangePasswordRequestDto](../src/features/auth/dto/request/change-password.request.dto.ts): `currentPassword`, `newPassword`.

### User DTOs

- [CreateUserRequestDto](../src/features/users/dto/request/create-user.request.dto.ts): `email`, `username`, `password`, optional `status`, optional `name`.
- [UpdateUserRequestDto](../src/features/users/dto/request/update-user.request.dto.ts): partial `CreateUserRequestDto` without `password`.

### Shared HTTP DTOs

- [IdDto](../src/infrastructure/http/dto/id.dto.ts): UUID `id` param validation.
- [RemoveDto](../src/infrastructure/http/dto/remove.dto.ts): optional boolean `soft`. This DTO exists but is not used by current controllers.
- [RegistryDatesDto](../src/infrastructure/http/dto/registry-dates.dto.ts): timestamp shape for Swagger.
- [ErrorResponseDto](../src/infrastructure/http/dto/error-response.dto.ts): Swagger error DTO. Runtime errors use `GlobalExceptionFilter` instead.

## Response DTOs and Serialization

The project uses a custom `@Serialize()` decorator that applies `SerializeInterceptor`. It uses `plainToInstance()` with `excludeExtraneousValues: true`, so only `@Expose()` fields are returned.

### UserProfileResponseDto

File: [src/features/users/dto/response/user-profile.response.dto.ts](../src/features/users/dto/response/user-profile.response.dto.ts)

Exposes:

- `createdAt`
- `updatedAt`
- `deletedAt`
- `name`
- `username`
- `email`
- `role`
- `joinedAt`

### AdminUserResponseDto

File: [src/features/users/dto/response/admin-user.response.dto.ts](../src/features/users/dto/response/admin-user.response.dto.ts)

Exposes:

- `id`
- `name`
- `username`
- `email`
- `role`
- `status`
- `registeredAt`

### SessionResponseDto

File: [src/features/sessions/dto/response/session.response.dto.ts](../src/features/sessions/dto/response/session.response.dto.ts)

Exposes:

- `sessionId`
- `ipAddress`
- `deviceInfo`
- `validUntil`
- `lastActivityAt`
- `current`

## Validation Field Decorators

Files:

- [EmailField](../src/infrastructure/http/validation/fields/email-field.decorator.ts)
- [UsernameField](../src/infrastructure/http/validation/fields/username-field.decorator.ts)
- [PasswordField](../src/infrastructure/http/validation/fields/password-field.decorator.ts)

These combine Swagger metadata, transformation, and validation rules.

## Current DTO/Entity Observations

- `TimestampResponseDto` exposes `deletedAt`, but the embedded entity field is named `deleteAt`; no transform maps `deleteAt` to `deletedAt`.
- `UpdateUserRequestDto` permits `status` updates on the authenticated user profile endpoint.
- Some DTO files exist but are not currently used by controllers, including `RemoveDto` and `SessionsDto`.
