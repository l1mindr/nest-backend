# Architecture Overview

This project follows a **modular feature-based architecture** inspired by Clean Architecture and Domain-Driven Design (DDD) principles.

The main goal is to ensure:

- Separation of concerns
- High testability
- Scalability
- Infrastructure independence
- Predictable dependency flow

---

# Core Principles

## 1. Feature-First Design

Instead of grouping code by technical layer (controller/service/repository), the system is organized by **business features**.

This improves:

- Maintainability
- Isolation
- Team scalability
- Feature ownership

---

## 2. Layer Separation

The system is divided into 3 main layers:

- Core
- Features
- Infrastructure

---

# Core Layer

The `core` layer contains **framework-independent logic**.

It has no knowledge of database, HTTP, or external systems.

### Contains:

- DTOs
- Validation system
- Interceptors
- Device detection system
- Transforms
- Clock service

---

## Why Core exists?

We isolate reusable logic that should NOT depend on NestJS features or infrastructure.

### Example: ClockService
Instead of calling `Date.now()` directly in business logic, prefer a centralized time abstraction such as `ClockService`.

```ts
// Example: use ClockService in application code
const now = clockService.now(); // returns Date or timestamp
```

This approach improves testability and ensures consistent time handling across the application.
---

# Features Layer

The `features` layer contains all business logic modules.

Each module represents a bounded context.

- `auth`
- `users`
- `sessions`
- `token`
- `security`

---

## Why Features Layer exists?

Business logic should be isolated per domain to avoid coupling.

This allows:

- Independent development of features
- Easier testing
- Clear ownership boundaries

---

## Example Responsibility Split

### Auth Module
- Login / Register
- JWT issuance
- Authentication flow

### Users Module
- User lifecycle
- Profile management
- Soft delete / hard delete

### Sessions Module
- Session tracking
- Multi-device sessions
- Session rotation
- Session revocation

---

## Why Sessions is NOT inside Auth?

Because:

- Auth = identity verification
- Sessions = state management

They evolve independently.

---

# Infrastructure Layer

The `infrastructure` layer contains all external systems.

- `databases/`
- `redis/`
- `config/`
- `http/`
---

## Responsibility

- PostgreSQL (TypeORM)
- Redis (locking, caching)
- HTTP adapters
- Config management

---

## Why Infrastructure is isolated?

To ensure:

- Business logic is ORM-agnostic
- External tools can be replaced
- No framework lock-in