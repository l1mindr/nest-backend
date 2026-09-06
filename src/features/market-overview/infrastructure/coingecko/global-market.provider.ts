import { AppError } from '@core/errors/app.error';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  GlobalMarketDataEntry,
  GlobalMarketDataPort
} from '../../application/interfaces/market-overview.interface';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import globalMarketConfig from './global-market.config';

/**
 * The raw shape CoinGecko returns from `/global`. Deliberately private to
 * this adapter — nothing outside infrastructure may depend on the wire
 * format.
 */
interface CoinGeckoGlobalRecord {
  total_market_cap?: { usd?: unknown };
  market_cap_change_percentage_24h_usd?: unknown;
  market_cap_percentage?: { btc?: unknown; eth?: unknown };
  updated_at?: unknown;
}

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

@Injectable()
export class CoinGeckoGlobalMarketProvider implements GlobalMarketDataPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(globalMarketConfig.KEY)
    private readonly config: ConfigType<typeof globalMarketConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CoinGeckoGlobalMarketProvider.name);
  }

  /**
   * Fetches the current global market snapshot. Transient failures (rate
   * limit, timeout, 5xx, network) are retried with exponential backoff;
   * permanent rejections (unexpected 4xx, malformed body) fail immediately —
   * there is no queue job here to protect from burning retries, so permanent
   * errors are thrown directly rather than wrapped.
   */
  async fetchGlobalMarketData(): Promise<GlobalMarketDataEntry> {
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
            'CoinGecko global market request failed and will be retried'
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
      this.httpService.get<unknown>(`${this.config.baseUrl}/global`, {
        headers,
        timeout: this.config.timeoutMs
      })
    );

    return response.data;
  }

  /**
   * Maps the raw CoinGecko payload onto the provider-neutral
   * {@link GlobalMarketDataEntry} shape. Missing/non-numeric required fields
   * are treated as an invalid response — unlike the per-coin catalogue, there
   * is exactly one record here, so a malformed value is a hard failure rather
   * than something to skip.
   */
  private normalize(payload: unknown): GlobalMarketDataEntry {
    const record = this.record(payload);

    const totalMarketCapUsd = this.decimal(record.total_market_cap?.usd, 2);
    const btcDominancePercentage = this.decimal(
      record.market_cap_percentage?.btc,
      4
    );
    // Read from the same `market_cap_percentage` object as BTC, so the two
    // shares always come from one snapshot and no extra call is made.
    const ethDominancePercentage = this.decimal(
      record.market_cap_percentage?.eth,
      4
    );
    const marketCapChangePercentage24h = this.decimal(
      record.market_cap_change_percentage_24h_usd,
      4
    );
    const updatedAtSeconds = record.updated_at;

    if (
      totalMarketCapUsd === null ||
      btcDominancePercentage === null ||
      ethDominancePercentage === null ||
      typeof updatedAtSeconds !== 'number' ||
      !Number.isFinite(updatedAtSeconds)
    ) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return {
      totalMarketCapUsd,
      marketCapChangePercentage24h: marketCapChangePercentage24h ?? '0',
      btcDominancePercentage,
      ethDominancePercentage,
      updatedAt: new Date(updatedAtSeconds * 1000)
    };
  }

  private record(payload: unknown): CoinGeckoGlobalRecord {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    const data = (payload as { data?: unknown }).data;

    if (typeof data !== 'object' || data === null) {
      throw MarketOverviewErrors.providerInvalidResponse();
    }

    return data as CoinGeckoGlobalRecord;
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
