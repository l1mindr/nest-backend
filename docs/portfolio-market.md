# Portfolio and Market Data

The business architecture: how holdings are derived, how value and P&L are
computed, and where each price on the dashboard actually comes from.

Related: [entities.md](entities.md), [api.md](api.md), [caching.md](caching.md),
[usdt-toman.md](usdt-toman.md),
[email.md](email.md) for price-alert delivery.

## Assets, holdings, and the ledger

An **asset** is a tradable instrument with persisted market data
(`currentPrice`, `lastSyncedAt`). A **holding** is a quantity of one asset in one
portfolio. A **transaction** is a ledger entry.

Holdings are **derived from the transaction ledger**, not stored as an
independent truth. `GET /v1/portfolios/:id/valuation` prices ledger-derived
holdings so valuation cannot drift from what `GET /v1/holdings` reports.
Fully-exited positions (amount 0) are filtered out before valuation — they are
worth nothing and would otherwise count as unvalued.

## Transaction types

`PortfolioTransactionType` — six, not three:

| Type | Effect |
|------|--------|
| `BUY` | Increases quantity, adds to cost basis |
| `SELL` | Decreases quantity, realizes P&L against cost basis |
| `TRANSFER_IN` | Increases quantity |
| `TRANSFER_OUT` | Decreases quantity |
| `DEPOSIT` | Increases quantity |
| `WITHDRAWAL` | Decreases quantity |

Transfers carry a destination, typed by `TransferDestinationType`:

| Value | Requirement |
|-------|-------------|
| `EXCHANGE` | An exchange name is required (`TRANSFER_EXCHANGE_NAME_REQUIRED`) |
| `WALLET` | A wallet that exists (`TRANSFER_WALLET_NOT_FOUND`) |

Missing destination raises `TRANSFER_DESTINATION_REQUIRED`. A type the
calculation engine does not handle raises `TRANSACTION_TYPE_NOT_SUPPORTED`; a
type that needs a price without one raises `TRANSACTION_PRICE_REQUIRED`.

Portfolios themselves carry a `PortfolioSourceType`: `LEDGER`, `EXCHANGE`,
`WALLET`, or `OTHER`.

## Opening balances

`PUT /v1/portfolios/:portfolioId/opening-balances/:assetId` sets a starting
quantity and cost for an asset, so a portfolio that existed before the ledger
did can be valued without back-filling its whole history.

An opening balance is an input to every downstream calculation for that asset.
Its `openingBalanceUpdatedAt` is tracked precisely because a **stale opening
balance invalidates all cached calculation state for that asset**.

## Valuation

`GET /v1/portfolios/:id/valuation`. Quote currency is **USD**
(`PORTFOLIO_VALUATION_CURRENCY`) — CoinGecko prices are quoted in USD.

For each holding: `value = amount × asset.currentPrice`, or `null` when no price
is available. The response reports `totalValue`, `valuedHoldings`,
`unvaluedHoldings`, the per-holding breakdown, a `status`, and `pricedAt`.

### Valuation status

`PortfolioValuationStatus` is derived, never stored:

| Status | Condition |
|--------|-----------|
| `EMPTY` | No holdings with a non-zero amount |
| `COMPLETE` | Every holding could be priced |
| `PARTIAL` | Some holdings priced, some not |
| `UNAVAILABLE` | Holdings exist, none could be priced |

A partial valuation is reported as partial rather than silently summing only what
it could price.

### `pricedAt`

The **oldest** `asset.lastSyncedAt` among the holdings that could actually be
priced, or `null` when nothing was priced.

Oldest rather than newest on purpose: it makes the value a floor — the valuation
is *at least* this fresh. This is the field a client uses to say how stale a
total is instead of presenting it as live. See the freshness section below.

## Cost basis and P&L

`GET /v1/portfolios/:portfolioId/pnl`.

Three strategies (`CostBasisStrategy`), selected per request, defaulting to
`AVERAGE`:

| Strategy | Behaviour |
|----------|-----------|
| `AVERAGE` | Weighted average cost across all acquisitions (default) |
| `FIFO` | First lot acquired is the first disposed |
| `LIFO` | Last lot acquired is the first disposed |

FIFO and LIFO are lot-based (`lot.ts`, `lot-cost-basis.calculator.ts`); AVERAGE
maintains a running average (`average-cost.calculator.ts`). All three are pure
domain code under `domain/calculation/`, dispatched by
`portfolio-calculation.engine.ts`.

**Realized P&L** accrues on disposals, measured against the cost basis the chosen
strategy assigns. **Unrealized P&L** is current value minus remaining cost basis.

### Decimal precision

All money and quantity arithmetic goes through `@core/decimal` — never
JavaScript floats. Terminating quotients are exact; only non-terminating ones are
truncated, at `CALCULATION_DIVISION_MAX_FRACTION_DIGITS = 26`. That bound mirrors
the domain's maximum monetary scale (`amount` ≤ 18 fractional digits, `price` ≤ 8,
so a product carries ≤ 26), keeping the error below 10⁻²⁶ — far beyond any
storage or presentation precision.

Calculation inputs are validated before use; failures raise codes prefixed
`CALCULATION_` (`CALCULATION_NEGATIVE_QUANTITY`, `CALCULATION_MISSING_PRICE`,
`CALCULATION_INSUFFICIENT_QUANTITY`, and so on).

## Two kinds of market data

This is the distinction most likely to be got wrong, and the dashboard shows both
side by side.

### Persisted asset market data

`asset.currentPrice` and `asset.lastSyncedAt`, stored on the asset row.

- Written by the **`asset-sync` BullMQ repeatable job**.
- Interval: `ASSET_SYNC_INTERVAL`, **default 3600 seconds (hourly)**.
- Retries: `ASSET_SYNC_QUEUE_ATTEMPTS` (default 4), backoff
  `ASSET_SYNC_QUEUE_BACKOFF_MS` (default 60000).
- This is what **portfolio valuation and P&L** read.

> A portfolio total can legitimately be **an hour behind** the `/v1/market/*`
> tickers shown elsewhere on the same page. That is why `pricedAt` exists. Do not
> describe portfolio valuation as real-time.

### Lightweight market data

Read on demand through `/v1/market/*` and `/v1/coins`, cached in memory per
replica, and **never persisted onto assets**:

| Endpoint | Source | Cache TTL | Env override |
|----------|--------|-----------|--------------|
| `GET /v1/market/overview` | CoinGecko `/global` | 90 s | `MARKET_OVERVIEW_CACHE_TTL_MS` |
| `GET /v1/market/bitcoin` | CoinGecko `/simple/price` | 30 s | `BITCOIN_MARKET_CACHE_TTL_MS` |
| `GET /v1/market/ethereum` | CoinGecko `/simple/price` | 30 s | `COIN_TICKER_CACHE_TTL_MS` |
| `GET /v1/market/usdt-toman` | Nobitex **or** Wallex (see [usdt-toman.md](usdt-toman.md)) | 60 s | `USDT_TOMAN_CACHE_TTL_MS` |
| `GET /v1/market/fear-greed` | Alternative.me | — | `FEAR_GREED_CACHE_TTL_MS` |

The caches are in-memory and per-replica, so N replicas make up to N upstream
calls per TTL window — acceptable for a public dashboard widget's request volume.

### Price-alert market data

The price-check scheduler fetches prices directly from CoinGecko in batches
(`PRICE_REQUEST_BATCH_SIZE = 50`, alerts paged at `ALERT_PROCESSING_PAGE_SIZE =
500`). It evaluates against those fetched prices — **not** against
`asset.currentPrice` — so an alert is not gated on the hourly sync.

## Market overview

`GET /v1/market/overview` surfaces the CoinGecko `/global` snapshot: total market
capitalisation, BTC dominance, and the accompanying global figures.

`GET /v1/market/fear-greed` surfaces the Alternative.me Fear & Greed index — an
independent third-party index, not computed here.

`GET /v1/market/usdt-toman` is a USDT/Toman rate from an Iranian exchange — a
different upstream from every other market endpoint, because CoinGecko does not
quote Iranian currency. Two exchanges back it, Nobitex and Wallex, with
`USDT_TOMAN_PROVIDER` choosing the preferred one and the other taking over
automatically when it fails. The rate is Toman whichever venue answered; see
[usdt-toman.md](usdt-toman.md) for the units and the fallback rules.

## Price alerts

| Enum | Values |
|------|--------|
| `AlertDirection` | Direction the price must cross |
| `AlertStatus` | Lifecycle state |
| `AlertTriggerMode` | How often an alert may fire |
| `NotificationChannel` | Delivery channel |

Endpoints: `POST`, `GET`, `PATCH /:id`, `DELETE /:id` on `/v1/price-alerts`.

Evaluation runs on the **`price-check` scheduler, every minute**
(`CronExpression.EVERY_MINUTE`). Each run counts checked, expired, triggered, and
skipped alerts and logs `PRICE_CHECK_STARTED` / `PRICE_CHECK_FAILED`.

A triggered alert does two things:

1. Publishes a `price-alert` email through the queue ([email.md](email.md)).
2. Publishes a `price-alert.triggered` realtime event, which the frontend uses to
   invalidate its price-alert queries.

## CoinGecko integration

| Variable | Purpose |
|----------|---------|
| `COINGECKO_BASE_URL` | API base |
| `COINGECKO_API_KEY` | **Secret.** API key |
| `COINGECKO_TIMEOUT_MS` | Per-request timeout |
| `COINGECKO_RETRIES` | Retry count |
| `COINGECKO_BACKOFF_MS` | Retry backoff |

Two independent CoinGecko clients exist, by design:

- `features/coin-tracker/infrastructure/coingecko/coingecko.client.ts` — coin
  catalogue and price-alert prices.
- `features/market-overview/infrastructure/coingecko/` — global market and coin
  ticker providers.

## Scheduled work

| Job | Schedule | Purpose |
|-----|----------|---------|
| `asset-sync` | BullMQ repeatable, `ASSET_SYNC_INTERVAL` (default hourly) | Writes `asset.currentPrice` / `lastSyncedAt` |
| `price-check` | `EVERY_MINUTE` | Evaluates price alerts |
| `coin-sync` | `EVERY_DAY_AT_1AM` | Refreshes the coin catalogue from CoinGecko |
| `pending-user-cleanup` | `EVERY_30_MINUTES` | Removes expired unverified registrations |

`POST /v1/assets/sync` triggers an asset sync on demand rather than waiting for
the interval.
