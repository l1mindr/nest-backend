# Entities & DTOs

## Core Entities

### User

```typescript
@Entity()
class User {
  id: string;              // UUID primary key
  name: string | null;     // Optional, `select: false`
  email: string;           // Unique, indexed
  username: string;        // Unique, max 30 chars
  password: string;        // `select: false`, bcrypt hashed
  status: UserStatus;      // Default PENDING_VERIFICATION
  role: UserRole;          // Default USER
  registryDates: RegistryDatesOrm;  // createdAt, updatedAt, deleteAt
  sessions: Session[];     // OneToMany, cascade soft-remove/recover
}
```

**Domain methods:**
- `unsuspend()` — Validates status is `SUSPEND`, transitions to `ACTIVATE`. Throws `invalidStatusTransition` for any other current status.

### Session

```typescript
@Entity()
class Session {
  id: string;                    // UUID primary key
  refreshTokenHash: string;      // SHA-256 of refresh JWT
  device: ISessionDevice;        // JSONB — browser, OS, device type
  ipAddress: string;             // Client IP
  isRevoked: boolean;            // Default false
  expiresAt: Date;               // 7 days from creation
  lastUsedAt: Date;              // Updated on refresh
  version: number;               // Optimistic concurrency, increments on rotation
  rotatedAt: Date;               // Timestamp of last rotation
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;                 // FK column, indexed by IDX_session_owner_active
  owner: User;                     // ManyToOne, indexed (ownerId, isRevoked, expiresAt)
}
```

### UserVerificationCode

```typescript
@Entity()
class UserVerificationCode {
  id: string;              // UUID primary key
  userId: string;          // Foreign key to User
  codeHash: string;        // bcrypt hash of verification code
  expiresAt: Date;         // 3 minutes from creation
  verifiedAt: Date | null; // Null until verified
  createdAt: Date;
}
```

Codes older than 24 hours are deleted by the pending-user cleanup schedule. The
`IDX_uvc_active_latest` partial index (`(userId, createdAt DESC) WHERE verifiedAt IS NULL`)
serves the latest-code lookup.

---

## Embedded Types

### RegistryDates (core — framework-agnostic)

```typescript
class RegistryDates {
  createdAt: Date;
  updatedAt: Date;
  deleteAt?: Date;
}
```

### RegistryDatesOrm (infrastructure — TypeORM decorated)

```typescript
class RegistryDatesOrm extends RegistryDates {
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deleteAt: Date;
}
```

---

## Enums

### UserStatus

| Value | Description |
|-------|-------------|
| `ACTIVATE` | Active, can authenticate |
| `DEACTIVATE` | Deactivated (default on creation — migrated to PENDING_VERIFICATION) |
| `SUSPEND` | Suspended, cannot authenticate |
| `PENDING_VERIFICATION` | Registered but email not yet verified |

**Transitions:**

```
PENDING_VERIFICATION → ACTIVATE (email verified)
ACTIVATE             → SUSPEND   (admin suspend)
SUSPEND              → ACTIVATE  (admin unsuspend)
```

Invalid transitions throw `INVALID_STATUS_TRANSITION` domain error. Status logic is owned by the `User.unsuspend()` domain method.

### UserRole

| Value | Description |
|-------|-------------|
| `USER` | Standard user (default) |
| `ADMIN` | Administrator |

---

## Error Codes

### DomainErrorCode

| Code | Description |
|------|-------------|
| `HTTP_EXCEPTION` | Unhandled HTTP exception |
| `INTERNAL_ERROR` | Unexpected internal error |
| `VALIDATION_ERROR` | Input validation failure |

### ErrorDomain

`AUTH`, `COIN_TRACKER`, `USER`, `SESSION`, `TOKEN`, `SYSTEM`, `HTTP`, `VALIDATION`, `SECURITY`

### UserErrorCode

| Code | Description |
|------|-------------|
| `USER_NOT_FOUND` | User does not exist |
| `EMAIL_ALREADY_EXISTS` | Email taken |
| `USERNAME_ALREADY_EXISTS` | Username taken |
| `INVALID_CURSOR` | Invalid pagination cursor |
| `INVALID_VERIFICATION_CODE` | Wrong, consumed, or expired verification code |
| `USER_ALREADY_SUSPENDED` | User already in SUSPEND state |
| `INVALID_STATUS_TRANSITION` | Status change not allowed |

### SessionErrorCode

`SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `SESSION_REUSE_DETECTED`, `REFRESH_RATE_LIMITED`, `INVALID_CURSOR`

### AuthErrorCode

`INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `ACCOUNT_NOT_VERIFIED`, `INVALID_CURRENT_PASSWORD`, `PASSWORD_MUST_BE_DIFFERENT`, `PASSWORD_CHANGE_FAILED`

### TokenErrorCode

`INVALID_TOKEN`, `EXPIRED_TOKEN`, `INVALID_REFRESH_TOKEN`

### SecurityErrorCode

`ACCESS_DENIED`, `AUTHENTICATION_REQUIRED`, `RATE_LIMIT_EXCEEDED`, `INVALID_CSRF_TOKEN`

---

## Shared DTOs

| DTO | Location | Purpose |
|-----|----------|---------|
| `IdDto` | `presentation/dto/` | UUID param validation |
| `ErrorResponseDto` | `presentation/dto/` | Error response shape (Swagger) |
| `TimestampResponseDto` | `presentation/dto/` | Base class with createdAt/updatedAt/deletedAt |

## Validation Fields

Reusable property decorators in `presentation/validation/fields/`:

| Decorator | Validates |
|-----------|-----------|
| `@EmailField()` | Email format, trimmed, lowercased |
| `@UsernameField()` | 3-30 chars, allowed chars, trimmed, lowercased |
| `@PasswordField()` | 8-20 chars, complexity requirements |

## Validation Decorators

In `presentation/validation/decorators/`:

| Decorator | Purpose |
|-----------|---------|
| `@IsPassword()` | Custom class-validator constraint |
| `@IsUsername()` | Custom class-validator constraint |
| `@TrimLowercase()` | Transform decorator |
