# USDT/Toman Rate

`GET /v1/market/usdt-toman` serves the live USDT price in Iranian Toman for the
dashboard's USDT/IRT tile. It is the only market route with two upstreams, and
the only one that talks to Iranian exchanges — CoinGecko does not quote Iranian
currency, so the CoinGecko-backed routes cannot supply this figure.

## Why two providers

The rate previously came from Nobitex alone, at `https://api.nobitex.ir`. That
host does not exist — it is NXDOMAIN on every public resolver, while
`nobitex.ir`, `www.nobitex.ir` and `apiv2.nobitex.ir` all resolve — so every
fetch failed at DNS resolution and the endpoint served an expired cached value
or a 502. Two things came out of that:

- the base URL now defaults to `apiv2.nobitex.ir`, which actually serves
  `/market/stats`; and
- a single exchange is a single point of failure for a figure the dashboard
  shows on every load, so a second one backs it up.

## The two exchanges

| | Provider A | Provider B |
|---|---|---|
| `USDT_TOMAN_PROVIDER` | `nobitex` | `wallex` |
| Endpoint | `GET https://apiv2.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls` | `GET https://api.wallex.ir/v1/markets` |
| Market key | `stats["usdt-rls"]` | `result.symbols.USDTTMN` |
| Price field | `latest` | `stats.lastPrice` |
| 24h change field | `dayChange` | `stats.24h_ch` |
| **Quote unit** | **Rial** | **Toman** |
| Authentication | none (public market data) | none (public market data) |

Both are the venues' official public market-data APIs. Neither takes a key, and
nothing here places an order or touches a private endpoint.

Wallex's `/v1/markets` returns every symbol (~450 KB) and ignores a `symbol`
query parameter, which is unattractive for a poll — but it is the only official
route carrying both the last price and the 24h change for the pair
(`/v1/depth` has no last price, `/v1/trades` has no 24h change). The shared
cache keeps it to one call per TTL rather than one per request.

## Units

The trap this route exists to avoid: **IRT is not IRR**. Iranian venues quote
either Rial or Toman, and 1 Toman = 10 Rial. A Rial figure passed off as Toman
is wrong by a factor of ten.

| Stage | Unit |
|---|---|
| Nobitex API response | **Rial** (`latest: "2346190"`) |
| Wallex API response | **Toman** (`lastPrice: "234251.0000000000000000"`, `quoteAsset: "TMN"`) |
| Internal (`UsdtTomanEntry.priceToman`) | **Toman**, decimal string |
| API response (`priceToman`) | **Toman**, decimal string |
| Dashboard tile | **Toman**, labelled `USDT/IRT` |

Conversion, in `infrastructure/usdt-toman/usdt-toman.normalizer.ts`:

- Nobitex: `priceToman = latest ÷ RIAL_PER_TOMAN` (default `10`)
- Wallex: `priceToman = lastPrice` (÷ 1 — no conversion, only validation and a
  trailing-zero trim, since Wallex pads prices to 16 decimals)

`RIAL_PER_TOMAN` is configurable so the assumption stays visible and can be
corrected without a code change if Nobitex ever switches its market to Toman.
There is deliberately **no** equivalent knob for Wallex: its market is Toman by
definition, and a divisor there would only invite someone to "fix" a
discrepancy by scaling a value that is already right.

Verified live on 2026-09-09: Nobitex 2,346,190 Rial → 234,619 Toman against
Wallex's 234,251 Toman — 0.16% apart, i.e. the ordinary spread between two
venues, not a unit mismatch.

### Precision

The division runs through the project's exact decimal helpers
(`src/core/decimal/decimal.util.ts`), not JS `number` arithmetic. The previous
implementation did `(latest / rialPerToman).toFixed(0)`, which both went through
a float and rounded the result away. Prices are carried as decimal strings from
the wire through to the response; the only value that touches a float is the
24h change, which Wallex already publishes as a JSON number.

## Selection and fallback

```
USDT_TOMAN_PROVIDER
        ↓
  preferred provider
        ↓
     success? ── yes ──→ return (provider: "<preferred>")
        │
        no
        ↓
   other provider
        ↓
     success? ── yes ──→ return (provider: "<other>"), logged at warn
        │
        no
        ↓
  MARKET_OVERVIEW_PROVIDERS_EXHAUSTED (502), logged at error
```

The order is deterministic: the preferred venue first, then the rest in the
order declared by `USDT_TOMAN_PROVIDERS` in
`infrastructure/usdt-toman/usdt-toman.config.ts`. It never depends on DI
resolution order. Setting `USDT_TOMAN_PROVIDER=wallex` reverses the pair, and
Nobitex becomes the fallback.

A venue is considered failed — and the next one tried — on a timeout, a
connection or DNS error, an HTTP 5xx, a rate limit (429), an unexpected 4xx, a
malformed body, or a market missing from the response. Zero and negative prices
count as malformed: a venue reporting a non-positive USDT rate is broken, and
failing over beats passing it on.

Each venue exhausts its own retry budget (`*_RETRIES`, transient failures only)
before the chain moves on, so a fully unreachable preferred venue delays the
fallback by roughly `backoff × 2^n`. Malformed bodies and unexpected 4xx are
permanent and are not retried.

`FailoverUsdtTomanProvider` implements `UsdtTomanPort` itself, so the cache and
the use case above it are unchanged and know nothing about there being more
than one venue.

### Switching provider

Set the environment variable and restart — no source change:

```env
USDT_TOMAN_PROVIDER=nobitex   # default; Wallex is the fallback
```

```env
USDT_TOMAN_PROVIDER=wallex    # Nobitex is the fallback
```

Supported values are exactly `nobitex` and `wallex`. Anything else — including
a case mismatch like `Nobitex` — fails Joi validation at startup rather than
silently defaulting, so a typo cannot quietly change which exchange a
deployment prices from.

## Caching

One in-memory, per-replica TTL cache sits above the whole chain
(`UsdtTomanCacheService`, `USDT_TOMAN_CACHE_TTL_MS`, default 60 s) — the same
abstraction and TTL policy as the other live tickers. There is no second layer
and no per-provider cache: both venues answer the same question in the same
unit, so a rate from the fallback is exactly as cacheable as one from the
preferred venue.

- Only a **successful** fetch is written, so a failing provider can never
  overwrite a good value.
- On a cache hit within the TTL, no exchange is called at all.
- If every exchange fails and an **expired** entry is still held, that value is
  served rather than failing the request — flagged `isStale: true` and keeping
  its original `fetchedAt`. It is never presented as a fresh read.
- With no cached value at all, the request fails.

`provider` travels on the cache entry, so a cached response still reports the
venue the price actually came from.

## Response

```jsonc
{
  "priceToman": "234619",              // Toman, not Rial
  "priceChangePercentage24h": "3.3000",
  "provider": "nobitex",               // which exchange answered
  "updatedAt": "2026-09-09T14:35:00.000Z",  // read time; neither venue publishes a tick
  "fetchedAt": "2026-09-09T14:35:00.000Z",  // when this backend last fetched
  "isStale": false
}
```

`priceToman` is normally integer-valued, since both venues quote whole units. A
fractional part is possible when a Rial quote does not divide evenly by 10.

## Observability

Logged by `FailoverUsdtTomanProvider`:

| Event | Level | Message |
|---|---|---|
| Provider failed, fallback remains | `warn` | `USDT price provider "nobitex" failed; falling back to "wallex"` |
| Fallback succeeded | `warn` | same, with `failedOver: true` on the answering venue |
| Provider failed, no fallback left | `warn` | `USDT price provider "wallex" failed and no fallback remains` |
| Every provider failed | `error` | `All USDT price providers failed` |

Each carries `provider`, `category` (`rate_limited` / `timeout` /
`unavailable` / `bad_request` / `invalid_response` / `unknown`), `status` where
the upstream gave one, and `durationMs`.

A successful fallback resolves normally — the rate is just as valid for having
come from the second venue — but is logged at `warn` so it stays visible rather
than passing as an ordinary success.

Hosts, query strings, headers and credentials are never logged. The structured
fields are limited to the venue name, failure category, upstream status and
timing; the error object travels under `err`.

## Toman-denominated transactions

The rate has a second consumer besides the dashboard tile: a BUY or SELL can be
entered with `priceCurrency: "TOMAN"`, and the transaction use case converts the
price and fee to USD through this same use case — the cache and the failover
chain included. The portfolio feature imports `MarketOverviewModule` for that
one export and reaches no exchange itself.

The rate applied is written onto the transaction row and frozen there, so a
later market move never restates a recorded trade. See
[api.md](api.md#toman-denominated-entry) for the columns and the contract.

A Toman entry fails outright when no rate can be obtained
(`TRANSACTION_PRICE_RATE_UNAVAILABLE`, 503) rather than falling back to reading
the figure as dollars — which would record a price roughly 234,000x too low.

## Testing

Every test stubs the HTTP boundary or the adapter — none reaches a live
exchange, so the suite does not depend on venue availability or on the
network.

| Suite | Covers |
|---|---|
| `infrastructure/nobitex/__tests__/usdt-toman.provider.spec.ts` | Success, malformed/zero/negative price, timeout, HTTP error, rate limit, DNS failure, retry policy |
| `infrastructure/wallex/__tests__/usdt-toman.provider.spec.ts` | The same matrix for Wallex |
| `infrastructure/usdt-toman/__tests__/usdt-toman.normalizer.spec.ts` | Unit conversion, precision, validation |
| `infrastructure/usdt-toman/__tests__/failover-usdt-toman.provider.spec.ts` | Selection order both ways, fallback in both directions, exhaustion, log fields |
| `application/use-cases/__tests__/get-usdt-toman.use-case.spec.ts` | Cache hit/miss, stale marking, no overwrite on failure |
| `test/v1/market-usdt-toman-v1.e2e-spec.ts` | The route end to end through the real chain, cache and DTO |
