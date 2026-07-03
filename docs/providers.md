# Providers Abstraction Layer

This document explains the purpose and design of three core provider abstractions used across the codebase: `ClockProvider`, `HashingProvider`, and `TokenProvider`. It focuses on why these abstractions exist, why we avoid calling libraries directly throughout the codebase, and the benefits they provide for testing and flexibility.

---

## Why use provider abstractions?

- Encapsulation: centralize interactions with third-party libraries behind small, well-defined interfaces.
- Swapability: replace implementations (e.g., bcrypt → Argon2, HS256 → RS256) without touching business logic.
- Testability: provide simple, fast fakes/mocks for unit tests instead of complex or slow library behavior.
- Consistency: standardize behavior (error handling, parameter choices, logging) in one place.
- Security: centralize sensitive operations (hashing, token signing) so key management and policy updates are localized.

In short: providers are small adapters that decouple application logic from implementation details.

---

## ClockProvider

Purpose:
- Provide a time abstraction used by business logic, tests, and other providers.

Typical interface (conceptual):
- `now(): Date`
- `nowTs(): number` (timestamp)
- `utc(): Date` (if normalization is needed)

Why it exists:
- Makes time deterministic in tests by allowing injection of a fake clock.
- Encapsulates adjustments (timezone normalization, monotonic counters) in one place.
- Avoids sprinkling `Date.now()` throughout the codebase which inhibits testing and time-control.

Testing benefit:
- In unit tests, inject a fake `ClockProvider` that returns a predictable time or can be advanced manually to test expiry/rotation logic.

---

## HashingProvider

Purpose:
- Standardize password and token hashing operations across the application.

Conceptual interface:
- `hash(value: string): Promise<string>`
- `verify(value: string, hash: string): Promise<boolean>`
- `needsRehash(hash: string): boolean` (optional — useful for migration)

Why not call bcrypt/argon2 directly everywhere:
- Parameter management: cost factors, memory, and time parameters should be set centrally and vary by environment.
- Upgrade/migration: when changing algorithms or parameters, central provider can implement rehash-on-login flows.
- Security: centralize error handling, logging, and the use of constant-time comparisons.

Testing benefit:
- Replace `HashingProvider` with a fast synchronous stub in unit tests that returns deterministic outputs instead of running expensive hashing.
- In integration tests, use a configured real implementation.

Additional notes:
- Always store and compare hashes using secure library methods; provider should never expose raw salt handling externally.
- Consider a `hashVersion` metadata scheme if rolling multiple hashing strategies.

---

## TokenProvider

Purpose:
- Abstract access/refresh token creation, signing, verification, and parsing.

Conceptual interface (combined responsibilities):
- `signAccess(payload: object, opts?): Promise<string>`
- `verifyAccess(token: string): Promise<Payload>`
- `generateRefresh(sessionId, version): Promise<string>`
- `validateRefresh(token: string): Promise<{ sessionId, version } | null>`

Why an abstraction:
- Key management: hide details of signing keys, `kid` handling, and rotation.
- Algorithm flexibility: switch between HS*/RS* families without changing callers.
- Token format: allow opaque refresh tokens (server-backed) or JWT refresh tokens to be swapped transparently.
- Centralize claim generation and validation rules (issuer, audience, expirations).

Testing benefit:
- Provide deterministic token stubs in unit tests.
- Allow integration tests to exercise real signing/verification with test keys.

Security considerations handled by provider:
- Ensure tokens contain minimal claims and do not leak sensitive information.
- Implement `kid` handling and key rotation support.
- Optionally support token revocation hooks (e.g., emit events when refresh tokens are generated or invalidated).

---

## Common patterns and best practices

- Keep provider interfaces small and stable. Business logic should depend on the interface, not on implementation details.
- Provide two implementations for each provider in the codebase:
  - `production` (real) implementation using the chosen library (Argon2/bcrypt, jsonwebtoken, etc.).
  - `test` implementation (fast fake) used in unit tests and CI where appropriate.
- Use dependency injection (NestJS providers) to register implementations and make swapping straightforward per environment.
- Document provider contracts and include example usages in `docs/` so maintainers know what behavior to expect.

---

## Examples of benefits in this codebase

- Clock-based expiry tests for refresh token rotation can run instantly with a fake `ClockProvider`.
- When migrating from bcrypt to Argon2, update `HashingProvider` and add `needsRehash()` logic; no changes to `auth` code.
- Switching token signing from symmetric to asymmetric keys requires only `TokenProvider` changes; `AuthGuard` and controllers remain unchanged.

---

## Implementation notes

- Keep provider constructors lightweight; inject configuration (cost, keys) rather than hard-coding.
- Validate configuration at startup and fail fast if secrets are missing.
- Protect private keys using environment secrets or a secrets manager; `TokenProvider` should read keys from secure sources.

---

## Next steps

- Add interface definitions (TypeScript) for each provider under `src/core/providers/` and a `docs/providers-usage.md` with examples.
- Add unit tests for `HashingProvider` migration logic and `TokenProvider` key rotation handling.
