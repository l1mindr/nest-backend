# Glossary

| Term | Definition |
|------|------------|
| **Access Token** | Short-lived (15 min) JWT stored in httpOnly `access_token` cookie. Used to authenticate API requests. |
| **Active Session** | A `Session` record that is not revoked and has not expired. Validated on every authenticated request. |
| **AppError** | Base domain error class. Contains `code`, `domain`, `statusCode`, and optional `metadata`. Used across all feature modules. |
| **CSRF Token** | Stateless structured token (`nonce.expiresAt.signature`, HMAC-SHA256) stored in a readable `csrf_token` cookie. Sent as `X-CSRF-Token` header on unsafe methods. |
| **Data Response Envelope** | `{ data: ... }` wrapper applied by `DataResponseInterceptor` to all successful responses. |
| **Device Context** | Parsed User-Agent metadata: browser, OS, device type. Attached to requests by `DeviceMiddleware`. |
| **Feature Module** | Business domain module following the `presentation/application/domain/infrastructure` structure. |
| **LogEvent** | Enum of structured event names used with Pino logger for security and business event tracking. |
| **Refresh Token** | Long-lived (7 days) JWT stored in httpOnly `refresh_token` cookie. Used to obtain new token pairs. SHA-256 hashed before storage. |
| **Rotation** | Process of replacing a token pair during refresh. Old refresh token is invalidated. Uses optimistic concurrency via `version` field. |
| **Session Version** | Integer field on Session entity incremented on each rotation. Used for optimistic locking to detect concurrent reuse. |
| **User Role** | `USER` (default) or `ADMIN`. Controls access to admin endpoints. |
| **User Status** | `PENDING_VERIFICATION` (default on register), `ACTIVATE`, `SUSPEND`, `DEACTIVATE`. Controls login eligibility. |
| **Verification Code** | bcrypt-hashed 6-digit code sent via email. 3-minute TTL. Used to activate accounts after registration. |
