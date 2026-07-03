# FAQ — Architectural Questions

This file answers common architecture questions for quick reference.

---

## Why `ClockService` instead of `Date.now()`?

- Testability: `ClockService` can be injected and replaced with a fake in tests, allowing deterministic time advancement and expiry testing.
- Consistency: centralizes timezone normalization, monotonic or mocked time behavior, and avoids scattered ad-hoc time handling.
- Decoupling: business logic depends on an interface (`now()`), not a global API, making future changes (e.g., monotonic clocks or telemetry) easier.

Example: in tests you can advance the fake clock to simulate token expiry without waiting wall-clock time.

---

## Why session versioning instead of Redis-only locks?

- Deterministic single-winner: optimistic `version` + atomic DB conditional update guarantees exactly one successful rotation (DB enforces it).
- Replay/reuse detection: storing previous hashes with versions allows explicit detection of token reuse and immediate revocation.
- Lock limitations: Redis locks rely on TTLs and are subject to expiry, process crashes, clock drift, and partition issues — they reduce but do not eliminate races.
- Simpler operations: DB atomic update avoids extra network hop and recovery complexity; it is the single source of truth for session state.

Use locks only when coordinating actions across different systems or when DB atomic updates cannot cover cross-datastore invariants.

---

## Why providers (Clock/Hashing/Token) instead of calling libraries directly?

- Swapability: replace implementations (bcrypt → Argon2, HS256 → RS256) without changing business code.
- Centralized policy: cost factors, key rotation, claim rules, and error handling live in one place.
- Testability: providers enable fast fakes for unit tests and controlled integration tests for real implementations.
- Security: sensitive operations and key access are centralized, reducing accidental leaks and making audits easier.

Providers act as small adapters that expose a stable, minimal API to the application.

---

## Why separate `infrastructure` from `features`?

- Clear dependency flow: `features` (business logic) depend on `core` + `infrastructure` abstractions, not on concrete infra implementations — reduces coupling.
- Replaceability: swap databases, queues, or HTTP adapters without changing business code.
- Testability: mock or fake infrastructure layers during unit tests while keeping feature logic unchanged.
- Team ownership: isolates operational concerns (deployment, scaling, infra configs) from product domain code.

Separation enforces architecture boundaries and keeps business code framework- and vendor-agnostic.

---

If you'd like, I can: add short code examples for each answer, or commit and push these docs now.