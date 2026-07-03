# Roadmap — Future Improvements

This roadmap outlines planned features, scalability improvements, and security enhancements for the project. It is organized into short-term, mid-term, and long-term initiatives with rationale and suggested checkpoints.

---

## Short-term (next 1–3 months)

### Planned features
- Audit & Monitoring: add structured audit events for auth flows (login, refresh, revoke) and instrument with JSON logs.
- Session UI: basic user-facing page listing active sessions with revoke buttons.
- Health endpoints: `/health`, `/ready` and metrics (`/metrics`) for Prometheus.
- Compodoc upkeep: integrate generated docs into CI artifacts and host static docs for team access.

### Scalability improvements
- Connection pool tuning for Postgres and Redis; configure appropriate pool sizes in `DataSource` and `ioredis` settings.
- Introduce Redis for short-lived caches (feature flags, rate-limiting counters) to reduce DB load.
- Add basic request-rate limiting middleware for auth endpoints.

### Security enhancements
- Add basic MFA option (TOTP) gated by feature flag.
- Implement refresh token rotation fully and ensure reuse detection is logged and alerted.
- Add dependency vulnerability scanning to CI (e.g., `npm audit`, Snyk or GitHub Dependabot).

---

## Mid-term (3–9 months)

### Planned features
- Device naming and session metadata editing in UI.
- Granular scopes/permissions and admin UI for role management.
- Exportable audit logs for compliance requests.

### Scalability improvements
- Read replica support for Postgres: move read-heavy queries to replicas and route via a read-replica pool.
- Horizontal API scaling with stateless services + shared Redis for ephemeral coordination.
- Add a caching layer (Redis) for common read paths and aggressively cache read-only lookup tables.
- Implement a jobs/worker queue (BullMQ) for background tasks and offload heavy synchronous work.
- Introduce CDNs for static `documentation/` hosting and companion health checks.

### Security enhancements
- Move secrets to a managed secrets store (Vault, AWS Secrets Manager) and remove secrets from environment files.
- Key rotation automation for JWT signing keys with `kid`-based verification support.
- Harden cookie & CSRF policies; add CSP and security headers via helmet-like middleware.

---

## Long-term (9–18+ months)

### Planned features
- Multi-tenant support (if product requires it) with tenant-scoped data partitioning and RBAC.
- Pluggable auth providers (OAuth2 social login) with secure federated identity patterns.

### Scalability improvements
- Autoscaling + horizontal database sharding strategies if data growth requires it.
- Observability platform maturation: distributed tracing (OpenTelemetry), full-service maps, SLOs and error budgets.
- Global deployment considerations: read replicas and multi-region caches for low-latency regions.

### Security enhancements
- Formal threat modeling and periodic red-team exercises.
- FIDO2/WebAuthn support for passwordless authentication.
- Formalized incident response playbooks and automated containment (e.g., bulk revocation endpoints).

---

## Cross-cutting initiatives

- Testing & CI: speed up CI with DB templates or cached migration snapshots; add more E2E coverage for security-critical flows.
- Documentation: keep `docs/` updated; generate diagrams and onboarding guides for new engineers.
- Observability: centralize logs, metrics, and alerts; add dashboards for auth and session metrics (refresh failures, reuse detections).
- Cost & Maintenance: track cloud costs for data egress and Redis/Postgres usage; consider tiered caching.

---

## Suggested milestones & checkpoints

1. Implement metrics and health endpoints + CI vulnerability scanning (short-term).
2. Complete refresh rotation + reuse detection and add session UI (short→mid).
3. Add read replica support and caching layer; validate on staging (mid-term).
4. Automate key rotation and migrate secrets to a managed provider (mid→long).
5. Introduce distributed tracing and SLOs (long-term).

---

## How to use this roadmap

- Treat this as a living document; update as priorities and risks evolve.
- Turn roadmap items into issues with acceptance criteria, design notes, and tests.
- Track progress with milestone tags in the issue tracker and iterate based on feedback.

---

If you'd like, I can open issue templates for the short-term items and scaffold the session UI routes and API.
