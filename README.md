# NestJS Backend - L1Mind

A full-featured NestJS TypeScript backend customized for **L1Mind projects**.

This project follows a modular architecture and includes authentication, session management, role-based access control, soft-delete lifecycle, and full API documentation using Swagger.

---

## Table of Contents

- [NestJS Backend - L1Mind](#nestjs-backend---l1mind)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Scripts](#scripts)
  - [Project Architecture](#project-architecture)
  - [Authentication \& Security](#authentication--security)
  - [Session System](#session-system)
  - [User Lifecycle](#user-lifecycle)
  - [Swagger \& API Docs](#swagger--api-docs)
    - [Example endpoints:](#example-endpoints)
  - [Testing](#testing)
  - [Support](#support)
  - [License](#license)

---

## Installation

```bash
yarn install
````

---

## Scripts

```bash
# Build
yarn build

# Format code
yarn format

# Start app
yarn start

# Development mode
yarn start:dev

# Debug mode
yarn start:debug

# Production
yarn start:prod

# Lint
yarn lint

# Unit tests
yarn test

# Watch tests
yarn test:watch

# Test coverage
yarn test:cov

# Debug tests
yarn test:debug

# End-to-end tests
yarn test:e2e

# Migrations
yarn migration:create
yarn migration:generate
yarn premigration:run
yarn migration:run
yarn migration:revert

# Documentation
yarn docs

# Husky
yarn prepare

# Deprecated files scan
yarn deprecated
```

---

## Project Architecture

Feature-based modular structure:

* **AuthModule**

  * Registration
  * Login
  * JWT issuance
  * Password change
  * Guards & strategies
  * Cookie interceptor

* **UsersModule**

  * Profile management
  * Password management
  * Soft delete
  * Hard delete
  * Account lifecycle

* **SessionsModule**

  * Session issuing
  * Multi-device login
  * Session revocation
  * Active session listing
  * Device tracking

* **AdminUsersModule**

  * Admin-only user listing
  * Admin-only user fetch
  * Role-based access control

---

## Authentication & Security

* JWT-based authentication
* Password hashing via `BcryptProvider`
* HttpOnly cookie support via interceptor
* Role-based access control (RBAC)
* Guard-based authorization
* Token + Session validation
* Separation of concerns:

  * Auth → identity
  * Users → domain
  * Sessions → state

---

## Session System

Each login creates a session:

* Device info stored
* IP stored
* Token stored
* Expiry date stored
* Multi-session supported
* Selective revocation:

  * Revoke current
  * Revoke others
  * Revoke all

---

## User Lifecycle

User deletion flow:

1. User requests account deletion
2. `softDelete` applied (`deletedAt` set)
3. User remains in DB for 72 hours
4. Scheduled cleanup checks `deletedAt`
5. After 72h → `hardDelete`
6. Data permanently removed

This enables:

* Recovery window
* Legal compliance
* Data safety
* GDPR-style lifecycle

---

## Swagger & API Docs

Swagger is fully integrated.

Run server and access:

```txt
http://localhost:3000/api
```

### Example endpoints:

Auth:

* `POST /auth/register`
* `POST /auth/login`
* `POST /auth/change-password`

Sessions:

* `GET /sessions`
* `DELETE /sessions`
* `DELETE /sessions/others`

Users:

* `GET /user/me`
* `PUT /user`
* `DELETE /user`

Admin:

* `GET /admin/users`
* `GET /admin/users/:id`

---

## Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Coverage
yarn test:cov
```

Testing stack:

* Jest
* Supertest
* Isolated modules
* E2E pipelines

---

## Support

Maintained by **L1Mindr**

<!-- * Website: [https://mintegs.com](https://mintegs.com) -->
* Telegram: [https://t.me/l1Mindr](https://t.me/l1mindr)
* Youtube: [https://www.youtube.com/@l1Mindr](https://www.youtube.com/@l1mindr)
* Tech content & dev branding: **L1Mindr**

---

## License

MIT License
