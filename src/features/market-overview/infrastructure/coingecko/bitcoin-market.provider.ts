import { AppError } from '@core/errors/app.error';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  BitcoinMarketEntry,
  BitcoinMarketPort
} from '../../application/interfaces/bitcoin-market.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import globalMarketConfig from './global-market.config';

/**
 * The raw shape CoinGecko returns from `/simple/price`. Deliberately private
 * to this adapter — nothing outside infrastructure may depend on the wire
 * format.
 */
interface CoinGeckoSimplePriceRecord {
  usd?: unknown;
  usd_24h_change?: unknown;
  last_updated_at?: unknown;
}

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

/**
 * `/simple/price` is CoinGecko's purpose-built lightweight ticker endpoint —
 * the appropriate tool for "just the current price of one coin", as opposed
 * to `/coins/markets` (the paginated catalogue endpoint `assets` uses for its
 * hourly sync of the full supported-coin range).
 */
@Injectable()
export class CoinGeckoBitcoinMarketProvider implements BitcoinMarketPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(globalMarketConfig.KEY)
    private readonly config: ConfigType<typeof globalMarketConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CoinGeckoBitcoinMarketProvider.name);
  }

  /**
   * Fetches the current Bitcoin/USD ticker. Transient failures (rate limit,
   * timeout, 5xx, network) are retried with exponential backoff; permanent
   * rejections (unexpected 4xx, malformed body) fail immediately.
   */
  async fetchBitcoinMarketData(): Promise<BitcoinMarketEntry> {
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
            'CoinGecko bitcoin price request failed and will be retried'
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError ?? MarketOverviewErrors.providerUnavailable();
  }

  private async request(): Promise<unknown> {
    const headers = this.config.apiKey
      ? { 'x-cg-demo-api-key': this.config.apiKey }
      : undefined;

    const response = await firstValueFrom(
      this.httpService.get<unknown>(`${this.config.baseUrl}/simple/price`, {
        headers,
        timeout: this.config.timeoutMs,
        params: {
          ids: 'bitcoin',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_last_updated_at: true
        }
      })
    );

    return response.data;
  }

  /**
   * Maps the raw CoinGecko payload onto the provider-neutral
   * {@link BitcoinMarketEntry} shape. Missing/non-numeric required fields are
   * treated as an invalid response — there is exactly one record here, so a
   * malformed value is a hard failure rather than something to skip.
   */
  private normalize(payload: unknown): BitcoinMarketEntry {
    const record = this.record(payload);

    const priceUsd = this.decimal(record.usd, 8);
    const priceChangePercentage24h = this.decimal(record.usd_24h_change, 4);
    const updatedAtSeconds = record.last_updated_at;

    if (
      priceUsd === null ||
      typeof updatedAtSeconds !== 'number' ||
      !Number.isFinite(updatedAtSeconds)
    ) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return {
      priceUsd,
      priceChangePercentage24h: priceChangePercentage24h ?? '0',
      updatedAt: new Date(updatedAtSeconds * 1000)
    };
  }

  private record(payload: unknown): CoinGeckoSimplePriceRecord {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const bitcoin = (payload as { bitcoin?: unknown }).bitcoin;

    if (typeof bitcoin !== 'object' || bitcoin === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return bitcoin as CoinGeckoSimplePriceRecord;
  }

  /**
   * Sorts an upstream failure into retryable (transient) and non-retryable
   * (permanent) buckets. A non-axios failure is treated as transient.
   */
  private classify(error: unknown): ClassifiedError {
    // Thrown by normalize() itself — a malformed body is a permanent
    // condition for this attempt, not something a retry can fix.
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

  private decimal(value: unknown, scale: number): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    const fixed = value.toFixed(scale);
    if (fixed.includes('.')) {
      return fixed.replace(/0+$/, '').replace(/\.$/, '');
    }
    return fixed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
