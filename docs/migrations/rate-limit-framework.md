# Migration: multi-dimensional rate limiting

Replaces the address-only rate limiter, and the separate hand-rolled limiter in
the users feature, with one configurable framework. See
[security.md](../security.md#rate-limiting) for how it works.

## Before deploying

**Add `SECURITY_HASH_SECRET`.** It keys the HMAC behind device identifiers and
every rate-limit Redis key.

- **Production: required.** Minimum 32 characters, entropy-validated, and must
  differ from `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and
  `CSRF_TOKEN_SECRET`. The application will refuse to boot without it.
- **Everywhere else: defaulted.** No dev machine, CI job, or e2e worker needs a
  new value.

`pnpm generate:secrets production` now emits it alongside the others.

Rotating the secret invalidates all derived device identifiers and all
rate-limit keys at once. Counters reset; nothing errors.

**Alert on `security.rate_limit.degraded` before you ship.** `auth.login.*` and
`auth.verify.code` fail *closed*, so a Redis outage returns `429` on login. That
event is the only warning before it happens.

## Deploy

Redis keys are renamed. There is no data migration — stale keys expire on their
own TTL, all of which are an hour or less.

```
rate:limit:{route}:{ip}          ->  rl:{prefix}:{identifier}:{hash}
verify:attempts:{userId}         ->  rl:verify:attempts:user:{hash}
verify:email:{email}             ->  rl:verify:email:{hash}
verify:resend:cooldown:{userId}  ->  rl:resend:cooldown:user:{hash}
verify:resend:hourly:{userId}    ->  rl:resend:hourly:user:{hash}
```

Every counter resets to zero once, on deploy. **Do not ship during an active
credential-stuffing incident** — it hands the attacker a fresh budget.

## Behavioural changes

No breaking changes to any HTTP contract: paths, status codes, error codes, and
response bodies are unchanged. Additions are additive.

| # | Change | Impact |
|---|--------|--------|
| 1 | Login now also limits on email and device | Six failed logins against one account from many addresses now returns `429`; previously it did not. **This is the point of the change.** |
| 2 | The per-email login limit opens a 15-minute block | Anyone who knows an address can burn the budget and lock it out for 15 minutes. Mitigated by a limit of 10 rather than 5, and by a successful login resetting the counter — only failures accumulate. Set `blockDurationMs: 0` on `auth.login.email` to remove the lockout entirely. |
| 3 | `RateLimitGuard` runs ahead of `RolesGuard` and `CsrfGuard` | Requests rejected for CSRF or role now consume budget. Intentional — those are worth limiting. |
| 4 | Verify-email's `429` moved from the use case to the guard | Same status, same `RATE_LIMIT_EXCEEDED` code, same body. Now raised before any database work. |
| 5 | Resend hourly limit and cooldown stay imperative | Still returns `204` silently, never `429`, so a caller cannot tell a rate-limited address from an unregistered one. Unchanged. |
| 6 | `Retry-After` and `X-RateLimit-*` headers added | Additive. `Retry-After` also now appears on the refresh-lock `429`. |
| 7 | The `429` body gains `meta.retryAfter` | Additive. |
| 8 | `/v1/price-alerts/*` is now limited (30/60s on address and user) | Previously unlimited. |
| 9 | The route key is now `Controller.handler` | **Fixes a bypass:** the old fallback used `request.url`, which includes the query string, so appending `?x=1` minted a fresh bucket. |

### Internal API changes

- `@RateLimit({ limit, ttl })` is **removed**. Routes now take a policy group:
  `@RateLimit(RateLimitPolicies.Auth.Login)`, or an explicit list via
  `@RateLimit({ policies: [...] })`. All in-repo call sites were converted.
- `RateLimitCheckService` and `RateLimitCounterService` are deleted.
- `VerificationAttemptService` is deleted; its counters are now policies. Use
  cases inject `RATE_LIMIT_SERVICE` and call `consume` / `reset`.
- `verification.constants.ts` keeps only the code-lifetime constants. The
  attempt allowance, resend cooldown, and hourly budget are policies.
- `RedisKey.RATE_LIMIT` is now `'rl'`; the four `VERIFY_*` members are gone.
- `RedisCounterService` remains available but has no first-party caller.

## Operating notes

- **`X-Device-Id`** is honoured when it matches `^[A-Za-z0-9_-]{8,128}$`. Do not
  strip it at the edge unless you intend to disable the client-supplied half of
  the device dimension. A client that rotates it lands in a fresh bucket, so
  watch the share of requests reporting `deviceIdSource: 'header'` — a spike is
  the abuse signal. The server-derived identifier is always computed alongside
  it, so the dimension can be re-pointed at the unspoofable value by changing
  one line in `DeviceIdResolver`.
- **`trust proxy` is set to 1** (`bootstrap.ts`). With more than one proxy in
  front of the application, `req.ip` resolves to a proxy address and every
  client collapses into a single bucket. Raise the hop count to match your
  topology.
- **Changing a limit** is a one-line edit in
  `src/features/security/rate-limit/config/rate-limit.config.ts`. Nothing else
  hardcodes a limit, and a unit test enforces that.

## Rollback

Phases were kept separable. The guard wiring (which changes request handling for
existing routes) and the use-case absorption (which touches business logic) are
independent commits, so either can be reverted without the other. Reverting
resets counters again.
