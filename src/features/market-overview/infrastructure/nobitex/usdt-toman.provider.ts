import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { UsdtTomanEntry } from '../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import { ExchangeUsdtTomanProvider } from '../usdt-toman/exchange-usdt-toman.provider';
import {
  toPercentageChange,
  toTomanPrice
} from '../usdt-toman/usdt-toman.normalizer';
import nobitexUsdtTomanConfig from './usdt-toman.config';

/**
 * The raw shape Nobitex returns from `/market/stats`. Deliberately private to
 * this adapter — nothing outside infrastructure may depend on the wire format.
 */
interface NobitexStatsPayload {
  status?: unknown;
  stats?: Record<string, { latest?: unknown; dayChange?: unknown } | undefined>;
}

/** Nobitex's own key for the USDT/Rial market. */
const USDT_RIAL_SYMBOL = 'usdt-rls';

/** The `USDT_TOMAN_PROVIDER` value that selects this adapter. */
export const NOBITEX_PROVIDER_NAME = 'nobitex';

/**
 * USDT/Toman rate from Nobitex's public market statistics — one of the two
 * exchange adapters behind `UsdtTomanPort`, and the default preference.
 *
 * CoinGecko does not quote Iranian Rial, so the Iranian venues are separate
 * upstreams rather than another endpoint on the existing one. Retry, backoff
 * and failure classification come from {@link ExchangeUsdtTomanProvider} and
 * are shared with the Wallex adapter.
 *
 * Units: `/market/stats` prices the `usdt-rls` market in **Rial**, so the
 * reply is divided by `rialPerToman` (10) to reach the Toman the application
 * serves. Verified against the live endpoint: `latest: "2346190"` Rial against
 * Wallex's `"234251"` Toman for the same market, i.e. the same quantity to
 * within the usual spread between venues.
 */
@Injectable()
export class NobitexUsdtTomanProvider extends ExchangeUsdtTomanProvider {
  readonly name = NOBITEX_PROVIDER_NAME;

  constructor(
    private readonly httpService: HttpService,
    @Inject(nobitexUsdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof nobitexUsdtTomanConfig>,
    protected readonly logger: PinoLogger
  ) {
    super();
    this.logger.setContext(NobitexUsdtTomanProvider.name);
  }

  protected get retries(): number {
    return this.config.retries;
  }

  protected get backoffMs(): number {
    return this.config.backoffMs;
  }

  protected async request(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>(`${this.config.baseUrl}/market/stats`, {
        timeout: this.config.timeoutMs,
        params: { srcCurrency: 'usdt', dstCurrency: 'rls' }
      })
    );

    return response.data;
  }

  /**
   * Maps the raw Nobitex payload onto {@link UsdtTomanEntry}.
   *
   * `dayChange` is optional: a missing change degrades to `0` rather than
   * failing the whole rate, matching how the CoinGecko provider treats its own
   * 24h change. There is no provider timestamp on this endpoint — the rate is
   * "as of now" — so `updatedAt` is the moment of the successful read.
   */
  protected normalize(payload: unknown): UsdtTomanEntry {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const { stats } = payload as NobitexStatsPayload;
    const market = stats?.[USDT_RIAL_SYMBOL];

    if (typeof market !== 'object' || market === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return {
      priceToman: toTomanPrice(market.latest, this.config.rialPerToman),
      priceChangePercentage24h: toPercentageChange(market.dayChange),
      updatedAt: new Date(),
      provider: this.name
    };
  }
}
