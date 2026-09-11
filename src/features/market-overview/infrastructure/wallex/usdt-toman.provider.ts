import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { UsdtTomanEntry } from '../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import { ExchangeUsdtTomanProvider } from '../usdt-toman/exchange-usdt-toman.provider';
import {
  TOMAN_PER_TOMAN,
  toPercentageChange,
  toTomanPrice
} from '../usdt-toman/usdt-toman.normalizer';
import wallexUsdtTomanConfig from './usdt-toman.config';

/**
 * The slice of Wallex's `/v1/markets` body this adapter reads. Deliberately
 * private to this adapter — nothing outside infrastructure may depend on the
 * wire format.
 */
interface WallexMarketsPayload {
  result?: {
    symbols?: Record<
      string,
      | {
          stats?: { lastPrice?: unknown; '24h_ch'?: unknown };
        }
      | undefined
    >;
  };
}

/** Wallex's own key for the USDT/Toman market. */
const USDT_TOMAN_SYMBOL = 'USDTTMN';

/** The `USDT_TOMAN_PROVIDER` value that selects this adapter. */
export const WALLEX_PROVIDER_NAME = 'wallex';

/**
 * USDT/Toman rate from Wallex's public market list — the second exchange
 * behind `UsdtTomanPort`. Retry, backoff and failure classification come from
 * {@link ExchangeUsdtTomanProvider}, so a Wallex outage is categorised exactly
 * as a Nobitex one and the failover chain can treat them interchangeably.
 *
 * Units: the `USDTTMN` market is quoted in **Toman** already — Wallex reports
 * `quoteAsset: "TMN"` / `enQuoteAsset: "Toman"` for it — so unlike the Nobitex
 * adapter there is no Rial division. The value still goes through
 * `toTomanPrice` for validation and for the trailing-zero trim, since Wallex
 * pads prices to 16 decimals (`"234251.0000000000000000"`).
 *
 * Endpoint choice: `/v1/markets` returns every symbol (~450 KB) and Wallex
 * ignores a `symbol` query parameter on it, but it is the only official route
 * carrying both the last price and the 24h change for the pair — `/v1/depth`
 * has no last price and `/v1/trades` has no 24h change. The shared cache in
 * front of this keeps it to one call per TTL rather than one per request.
 */
@Injectable()
export class WallexUsdtTomanProvider extends ExchangeUsdtTomanProvider {
  readonly name = WALLEX_PROVIDER_NAME;

  constructor(
    private readonly httpService: HttpService,
    @Inject(wallexUsdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof wallexUsdtTomanConfig>,
    protected readonly logger: PinoLogger
  ) {
    super();
    this.logger.setContext(WallexUsdtTomanProvider.name);
  }

  protected get retries(): number {
    return this.config.retries;
  }

  protected get backoffMs(): number {
    return this.config.backoffMs;
  }

  protected async request(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>(`${this.config.baseUrl}/v1/markets`, {
        timeout: this.config.timeoutMs
      })
    );

    return response.data;
  }

  /**
   * Maps the raw Wallex payload onto {@link UsdtTomanEntry}.
   *
   * `24h_ch` is optional in the same way Nobitex's `dayChange` is: a missing
   * change degrades to `0` rather than failing the whole rate. Wallex publishes
   * no timestamp on this endpoint either, so `updatedAt` is the read time —
   * identical semantics to the Nobitex adapter, which is what lets the two be
   * swapped without the API's meaning shifting.
   */
  protected normalize(payload: unknown): UsdtTomanEntry {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const market = (payload as WallexMarketsPayload).result?.symbols?.[
      USDT_TOMAN_SYMBOL
    ];

    if (typeof market !== 'object' || market === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const stats = market.stats;

    if (typeof stats !== 'object' || stats === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return {
      priceToman: toTomanPrice(stats.lastPrice, TOMAN_PER_TOMAN),
      priceChangePercentage24h: toPercentageChange(stats['24h_ch']),
      updatedAt: new Date(),
      provider: this.name
    };
  }
}
