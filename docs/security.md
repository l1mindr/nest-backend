# Security Model

This document describes the system-wide security model: password hashing, JWT design, cookie handling, guards and decorators, validation, and exception handling strategies. It's focused on architecture and reasoning for maintainers and reviewers.

---

## Password Hashing Strategy

- Use a memory-hard, adaptive algorithm such as Argon2id (preferred) or bcrypt as fallback.
- Apply a per-password salt (handled by Argon2/bcrypt libraries) before hashing.
- Use cost parameters appropriate for environment (test/dev lower, production higher) and document them in configuration.
- Store only the resulting hash and associated salt/cost metadata when required (most libs embed salt/cost in the hash string).
- When verifying, use the library's verify function which safely handles timing and salt extraction.
- Rotate hashing scheme by storing version metadata alongside the hash and re-hash on the next successful login if needed.

Security rationale:
- Adaptive cost slows brute-force attacks, and memory hardness defends against GPU/ASIC cracking.
- Storing only hashes and salts prevents plaintext exposure on DB compromise.

---

## JWT Design

- Use short-lived access tokens (e.g., 5–15 minutes) and server-backed refresh tokens for session longevity.
- Token payloads should be minimal: `sub` (user id), `iat`, `exp`, `jti` (optional token id), `roles` or `scopes` if needed.
- Prefer RS256 (asymmetric) signing if verifying across services without sharing secrets; HS256 is acceptable if key management is simpler and centralized.
- Include `kid` header to rotate keys safely.
- Never include PII or sensitive data in JWT claims.
- Validate issuer, audience, signature, and expiration on every request.

Key management:
- Use a secure secrets manager for private keys (KMS, Vault). Do not check private keys into source control.
- Rotate keys periodically; support multiple keys during rollover with `kid`.

---

## Cookie Handling

- Use `HttpOnly` and `Secure` flags for cookies that carry tokens to protect from XSS and to require TLS.
- Use `SameSite=Lax` or `Strict` depending on cross-site integration needs; Lax is a reasonable default to allow top-level POST navigations.
- For refresh tokens, prefer `HttpOnly` cookies so JavaScript cannot access them; access tokens may be stored in memory (not persistent storage) for SPAs.
- Set an appropriate `path` and `domain` scoping for cookies; prefer narrow scope.
- Implement CSRF protection for cookie-based auth: either rely on `SameSite` with strict policies and/or use double-submit tokens or server-side anti-CSRF tokens for sensitive endpoints.

---

## Guards System (Authorization)

- Use NestJS Guards to implement auth checks at route or controller level.
- Provide an `AuthGuard` that verifies access JWTs, checks `sub` claim, and attaches a `request.user` principal.
- Implement `RolesGuard` and/or `ScopesGuard` that read claims (roles/scopes) and compare with required metadata.
- Protect sensitive endpoints with composition: `@UseGuards(AuthGuard, RolesGuard)`.
- Ensure guard failures return appropriate HTTP statuses (401 for unauthenticated, 403 for unauthorized).

Performance note:
- Keep guards lightweight: verification should be O(1) per request (signature check, expiration, optional lookup for session revocation).

---

## Decorators (Authorization/Extraction Helpers)

- Provide parameter decorators: `@CurrentUser()` to inject `request.user`, `@UserId()` to inject `request.user.id`, `@RequiredRoles(...roles)` to annotate roles metadata.
- Use decorators to keep controllers declarative and thin.
- Attach metadata via `Reflector` for Guards to read required permissions.

---

## Validation Layer

- Centralize validation using DTOs with `class-validator` and `class-transformer`.
- Use NestJS `ValidationPipe` globally to enforce DTO validation and transformation.
- Employ explicit `whitelist` and `forbidNonWhitelisted` options to reject unexpected payload fields.
- Normalize inputs (e.g., trim emails, lowercase where appropriate) in DTO transformers.
- Validate at the edge: every inbound request that touches business logic should pass through validation.

Security rationale:
- Prevents injection of unexpected fields and enforces schema guarantees at the boundary.

---

## Exception Handling Strategy

- Use a global exception filter to standardize error responses and avoid leaking internal details.
- Map known exception types to proper HTTP statuses (ValidationError -> 400, Unauthorized -> 401, Forbidden -> 403, NotFound -> 404, etc.).
- Log exceptions with correlation ids, but avoid logging sensitive information (passwords, tokens).
- For authentication errors, return generic messages to avoid user enumeration (e.g., "Invalid credentials" rather than "user not found").
- For critical security events (token reuse detection, multiple failed logins), emit structured audit events to the security monitoring pipeline.

---

## Additional Hardening

- Rate-limit authentication endpoints and sensitive flows.
- Employ Content Security Policy (CSP) and other HTTP security headers.
- Regularly run dependency vulnerability scans and keep core security libraries up-to-date.
- Conduct periodic key rotation and password-hash cost reviews.

---

## Next Steps

- Add example configs for Argon2 parameters and JWT key management in `docs/security-config.md`.
- Add unit and integration tests around guards, decorators, and exception handling.

***
