# User Activity

A user-facing record of what someone did in their own account, exposed at
`GET /v1/user/activity` and kept for 30 days.

## Activity is not the audit log

The two look similar and are deliberately separate. Mixing them would mean
either showing users an internal security record, or weakening that record to
make it presentable.

|                | User Activity                           | Audit Log                                  |
| -------------- | --------------------------------------- | ------------------------------------------ |
| Audience       | The user, reading their own history      | Operators, investigating an incident       |
| Collection     | `user_activities`                        | `audit_logs`                               |
| Retention      | 30 days, enforced by a TTL index         | Kept                                       |
| Exposed at     | `GET /v1/user/activity` (own rows only)  | `GET /v1/logs/audit` (`OWNER` role)        |
| Failure record | Successes only                           | Successes and failures (`success: boolean`) |
| Vocabulary     | `category` + `action`                    | A single flat `AuditAction`                |
| Request detail | None                                     | IP address, user agent, request id         |

Both live on the same MongoDB connection (`MONGODB_CONNECTION_NAME = 'logs'`).
That connection is shared, not the data: `ActivityModule` imports the existing
`MongoDbModule`, and because Nest caches modules by identity there is exactly
one connection in the process.

Recording an activity never replaces an audit entry. Where a use case writes
both, they are independent calls.

## Categories and actions

The two are stored as separate fields. `{ category: "TRANSACTION", action:
"CREATED" }`, never `"TRANSACTION_CREATED"` — a client can filter on the
category without parsing a compound string, each part is translated once
instead of once per combination, and adding an action to a category does not
require inventing a new identifier for the pair.

| Category      | Actions                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `SECURITY`    | `LOGIN`, `LOGOUT`, `PASSWORD_CHANGED`, `SESSION_CREATED`, `SESSION_REVOKED` |
| `PORTFOLIO`   | `CREATED`, `UPDATED`, `DELETED`                                            |
| `TRANSACTION` | `CREATED`, `UPDATED`, `DELETED`                                            |
| `PRICE_ALERT` | `CREATED`, `UPDATED`, `DELETED`, `ENABLED`, `DISABLED`                     |
| `ACCOUNT`     | `PROFILE_UPDATED`, `SETTINGS_UPDATED`                                      |

Which actions a category accepts is stated once in `ACTIVITY_CATALOG`
(`domain/activity-catalog.ts`) and checked before every write. A pair outside
the table is a call-site bug — it would persist a row no screen can render — so
the recorder logs it and drops it rather than storing it.

## Storage

`user_activities`, on the shared `logs` connection:

| Field        | Notes                                            |
| ------------ | ------------------------------------------------ |
| `userId`     | Required. Always the authenticated principal.    |
| `category`   | Required, enum.                                  |
| `action`     | Required, enum.                                  |
| `entityType` | Optional, e.g. `"PORTFOLIO"`.                    |
| `entityId`   | Optional.                                        |
| `metadata`   | Optional. Display-only — see below.              |
| `createdAt`  | Required.                                        |
| `expiresAt`  | Required. `createdAt + 30 days`. Drives the TTL. |

### Indexes

Two, and no more — every extra index is paid for on each write.

- `{ userId: 1, createdAt: -1 }` — the only read path: one user's activities,
  newest first. A category filter rides along as a predicate on that range; a
  user's 30-day window is small enough that narrowing by `userId` has already
  done the work.
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0` — retention.

## 30-day retention

`expiresAt` is set to `createdAt + 30 days` at write time, both derived from a
single clock read so the window cannot drift by the gap between two reads.

Deletion is MongoDB's, via the TTL index. `expireAfterSeconds: 0` means "delete
once `expiresAt` is in the past" rather than "delete zero seconds after
insertion", so the deadline lives in the document: the window can be changed for
future records without rebuilding the index.

**There is no cron job, and there should not be one.** A scheduled deletion in
application code only runs while the application does, and would quietly stop
enforcing the policy during any pause in deployment. MongoDB's TTL monitor runs
about once a minute, so removal is prompt but not instantaneous — nothing in the
API depends on the exact moment a record disappears.

Tests assert the index *configuration*, not the passage of time
(`user-activity.schema.spec.ts`).

## Pagination

Cursor-based, following `@core/pagination`. Default page 20, maximum 100.

```
GET /v1/user/activity?limit=20
GET /v1/user/activity?limit=20&cursor=<nextCursor>
GET /v1/user/activity?limit=20&category=TRANSACTION
```

```json
{ "items": [ ... ], "nextCursor": "eyJjcmVhdGVkQXQiOi..." }
```

`nextCursor` is `null` on the last page.

Ordering is `(createdAt DESC, _id DESC)`. `createdAt` alone is not a stable
sort key: two activities recorded in the same millisecond would order
arbitrarily between pages, so a row could be shown twice or skipped. The `_id`
breaks the tie, and since ObjectIds are monotonic within a millisecond it breaks
it in insertion order.

The cursor carries `{ createdAt, id }` as base64url, so the ObjectId is never
exposed as a bare identifier. A cursor that does not decode is reported as
`400 ACTIVITY_INVALID_CURSOR` rather than silently restarting from page one,
which would look to a caller like the list had changed under them.

The query asks for `limit + 1` rows; the extra row's presence is what reveals a
next page, without a second round trip for a count.

## Security and user isolation

The endpoint returns the caller's own activities and nothing else.

- The identity comes from the authenticated session, via `@User()`.
- `ListUserActivityRequestDto` has **no** `userId` field, so `?userId=...` is an
  unknown property and is stripped by the global validation pipe.
- `IListUserActivitiesUseCase.execute(userId, query)` takes the id as a separate
  argument, so it cannot be populated from the query object by mistake.
- `UserActivityQueryFilter.userId` is required and has no "all users" value —
  the type makes a cross-user query unexpressible, so isolation does not depend
  on each call site remembering a filter.

## Metadata rules

Metadata exists to render a row, and holds nothing else. It is a small,
display-only object:

```json
{ "assetSymbol": "BTC", "transactionType": "BUY" }
{ "portfolioName": "Long Term" }
{ "assetSymbol": "BTC", "condition": "ABOVE" }
```

Never store: passwords or hashes, access/refresh tokens, CSRF tokens, cookies,
API keys or secrets. Never store a whole request, entity or transaction
document.

Enforcement is belt and braces: `sanitizeMetadata` (shared with the audit log)
redacts sensitive keys in the recorder *and* again in the repository. The
recorder screens first because it is the layer that knows which call site
passed the value, so its log line can name the caller.

## Failure behaviour

Activity is telemetry, not the source of truth. A business operation that has
already succeeded is never reported as failed because its activity did not
persist.

`IUserActivityRecorder.record()` returns `void` and never throws:

- It is called *after* the operation commits, so there is nothing left to undo.
- Returning `void` rather than a promise keeps MongoDB latency off the request
  path and makes an unhandled rejection at a call site impossible.
- Every failure ends in a `logger.error` and a return.

There is deliberately no queue, outbox or event bus. Losing a row during a
MongoDB outage costs one line on a history screen, which does not justify the
operational weight of guaranteed delivery.

Consequently: if an operation fails, no activity is recorded — the recorder is
only reached on the success path.
