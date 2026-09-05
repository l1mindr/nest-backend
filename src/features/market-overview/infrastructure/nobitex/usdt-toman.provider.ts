import { AppError } from '@core/errors/app.error';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  UsdtTomanEntry,
  UsdtTomanPort
} from '../../application/interfaces/usdt-toman.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import nobitexUsdtTomanConfig from './usdt-toman.config';

/**
 * The raw shape Nobitex returns from `/market/stats`. Deliberately private to
 * this adapter — nothing outside infrastructure may depend on the wire format.
 */
interface NobitexStatsPayload {
  status?: unknown;
  stats?: Record<string, { latest?: unknown; dayChange?: unknown } | undefined>;
}

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

/** Nobitex's own key for the USDT/Rial market. */
const USDT_RIAL_SYMBOL = 'usdt-rls';

/**
 * USDT/Toman rate from Nobitex's public market statistics.
 *
 * CoinGecko does not quote Iranian Rial, so this is a second upstream rather
 * than another endpoint on the existing one. It mirrors the CoinGecko
 * providers' structure — same retry/backoff classification, same decimal
 * normalisation, same "malformed body is permanent" rule — so the two behave
 * identically under failure even though they talk to different venues.
 */
@Injectable()
export class NobitexUsdtTomanProvider implements UsdtTomanPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(nobitexUsdtTomanConfig.KEY)
    private readonly config: ConfigType<typeof nobitexUsdtTomanConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(NobitexUsdtTomanProvider.name);
  }

  /**
   * Fetches the latest USDT/Toman rate. Transient failures (rate limit,
   * timeout, 5xx, network) are retried with exponential backoff; permanent
   * rejections (unexpected 4xx, malformed body) fail immediately.
   */
  async fetchUsdtTomanRate(): Promise<UsdtTomanEntry> {
    const attempts = this.config.retries + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const payload = await this.request();
        return this.normalize(payload);
      } catch (error) {
        const classified = this.classify(error);

        if (classified.permanent) throw classified.error;

        lastError = classified.error;

        if (attempt < attempts) {
          const delayMs = this.config.backoffMs * 2 ** (attempt - 1);
          this.logger.warn(
            {
              attempt,
              nextAttempt: attempt + 1,
              backoffMs: delayMs,
              err: classified.error
            },
            'Nobitex USDT rate request failed and will be retried'
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError ?? MarketOverviewErrors.providerUnavailable();
  }

  private async request(): Promise<unknown> {
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
   * `latest` comes from the `rls` (Rial) market and is divided by
   * `rialPerToman` to give Toman — see the config for why that divisor exists.
   * `dayChange` is optional: a missing change degrades to `0` rather than
   * failing the whole rate, matching how the CoinGecko provider treats its own
   * 24h change. There is no provider timestamp on this endpoint — the rate is
   * "as of now" — so `updatedAt` is the moment of the successful read.
   */
  private normalize(payload: unknown): UsdtTomanEntry {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const { stats } = payload as NobitexStatsPayload;
    const market = stats?.[USDT_RIAL_SYMBOL];

    if (typeof market !== 'object' || market === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const latest = this.number(market.latest);

    if (latest === null || latest <= 0) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const dayChange = this.number(market.dayChange);

    return {
      priceToman: (latest / this.config.rialPerToman).toFixed(0),
      priceChangePercentage24h: (dayChange ?? 0).toFixed(4),
      updatedAt: new Date()
    };
  }

  /** Nobitex returns numbers as strings, so both forms are accepted. */
  private number(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  /**
   * Sorts an upstream failure into retryable (transient) and non-retryable
   * (permanent) buckets. A non-axios failure is treated as transient.
   */
  private classify(error: unknown): ClassifiedError {
    if (error instanceof AppError) {
      return { permanent: true, error };
    }

    if (isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 429) {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerRateLimited()
        };
      }

      if (status && status >= 500) {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerUnavailable()
        };
      }

      if (status) {
        return {
          permanent: true,
          error: MarketOverviewErrors.providerBadRequest()
        };
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          permanent: false,
          error: MarketOverviewErrors.providerTimeout()
        };
      }
    }

    return {
      permanent: false,
      error: MarketOverviewErrors.providerUnavailable()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
