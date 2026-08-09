import { LogEvent } from '@infrastructure/logging/logging.constants';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  MarketDataEntry,
  MarketDataPort
} from '../../application/interfaces/assets.interface';
import { AssetErrors } from '../../domain/errors/asset-errors';
import coingeckoConfig from './coingecko.config';

/**
 * The raw shape CoinGecko returns from `/coins/markets`. It is deliberately
 * private to this adapter: nothing outside infrastructure may depend on the
 * provider's wire format.
 */
interface CoinGeckoMarketRecord {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  image?: unknown;
  current_price?: unknown;
  market_cap?: unknown;
  market_cap_rank?: unknown;
  total_volume?: unknown;
  circulating_supply?: unknown;
  total_supply?: unknown;
  max_supply?: unknown;
  price_change_24h?: unknown;
  price_change_percentage_24h?: unknown;
}

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

@Injectable()
export class CoinGeckoMarketDataProvider implements MarketDataPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(coingeckoConfig.KEY)
    private readonly config: ConfigType<typeof coingeckoConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CoinGeckoMarketDataProvider.name);
  }

  /**
   * Fetches the configured market range, one paginated request at a time.
   *
   * Transient failures (rate limit, timeout, 5xx, network) are retried a
   * bounded number of times with exponential backoff. Permanent rejections
   * (unexpected 4xx) and malformed bodies fail immediately and are wrapped in
   * an {@link UnrecoverableError} so BullMQ does not burn the remaining job
   * attempts on them.
   */
  async fetchMarketData(): Promise<MarketDataEntry[]> {
    const entries: MarketDataEntry[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      const data = await this.fetchPage(page);

      entries.push(...data);
      this.logger.debug(
        {
          event: LogEvent.ASSET_SYNC_PROVIDER_REQUEST,
          page,
          records: data.length,
          baseUrl: this.config.baseUrl
        },
        'CoinGecko market data page fetched'
      );

      if (data.length < this.config.pageSize) break;
    }

    this.logger.info(
      {
        event: LogEvent.ASSET_SYNC_PROVIDER_COMPLETED,
        receivedCount: entries.length
      },
      'CoinGecko market data retrieval completed'
    );

    return entries;
  }

  private async fetchPage(page: number): Promise<MarketDataEntry[]> {
    const attempts = this.config.retries + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const payload = await this.request(page);

        if (!Array.isArray(payload)) {
          throw this.permanent(AssetErrors.providerInvalidResponse());
        }

        return this.normalize(payload);
      } catch (error) {
        if (error instanceof UnrecoverableError) throw error;

        const classified = this.classify(error);

        if (classified.permanent) throw classified.error;

        lastError = classified.error;

        if (attempt < attempts) {
          const delayMs = this.config.backoffMs * 2 ** (attempt - 1);
          this.logger.warn(
            {
              event: LogEvent.ASSET_SYNC_PROVIDER_RETRY,
              page,
              attempt,
              nextAttempt: attempt + 1,
              backoffMs: delayMs,
              err: classified.error
            },
            'CoinGecko request failed and will be retried'
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError ?? AssetErrors.providerUnavailable();
  }

  private async request(page: number): Promise<unknown> {
    const headers = this.config.apiKey
      ? { 'x-cg-demo-api-key': this.config.apiKey }
      : undefined;

    const response = await firstValueFrom(
      this.httpService.get<unknown>(`${this.config.baseUrl}/coins/markets`, {
        headers,
        timeout: this.config.timeoutMs,
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: this.config.pageSize,
          page
        }
      })
    );

    return response.data;
  }

  /**
   * Maps a raw CoinGecko page onto the provider-neutral {@link MarketDataEntry}
   * shape. Records that do not carry the required identity fields are skipped;
   * one malformed record never fails the whole run. Missing numeric values
   * become `null` — persisting layers decide whether that preserves or clears
   * an existing value.
   */
  private normalize(records: CoinGeckoMarketRecord[]): MarketDataEntry[] {
    const entries: MarketDataEntry[] = [];

    for (const record of records) {
      if (typeof record !== 'object' || record === null) continue;

      const coinGeckoId = this.string(record.id).toLowerCase();
      const symbol = this.string(record.symbol).toLowerCase();
      const name = this.string(record.name);

      if (!coinGeckoId || !symbol || !name) continue;

      entries.push({
        coinGeckoId,
        symbol,
        name,
        imageUrl: this.string(record.image) || null,
        currentPrice: this.decimal(record.current_price),
        marketCap: this.decimal(record.market_cap),
        marketCapRank: this.integer(record.market_cap_rank),
        totalVolume: this.decimal(record.total_volume),
        circulatingSupply: this.decimal(record.circulating_supply),
        totalSupply: this.decimal(record.total_supply),
        maxSupply: this.decimal(record.max_supply),
        priceChange24h: this.decimal(record.price_change_24h),
        priceChangePercentage24h: this.decimal(
          record.price_change_percentage_24h
        )
      });
    }

    return entries;
  }

  /**
   * Sorts an upstream failure into retryable (transient) and non-retryable
   * (permanent) buckets. A non-axios failure — a request that never got a
   * response, or a surprise thrown by the transport — is treated as transient.
   */
  private classify(error: unknown): ClassifiedError {
    if (isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 429) {
        return {
          permanent: false,
          error: AssetErrors.providerRateLimited()
        };
      }

      if (status && status >= 500) {
        return { permanent: false, error: AssetErrors.providerUnavailable() };
      }

      if (status) {
        return {
          permanent: true,
          error: this.permanent(AssetErrors.providerBadRequest())
        };
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return { permanent: false, error: AssetErrors.providerTimeout() };
      }
    }

    return { permanent: false, error: AssetErrors.providerUnavailable() };
  }

  /** Wraps a domain error so BullMQ skips the remaining attempts. */
  private permanent(error: Error): UnrecoverableError {
    return new UnrecoverableError(error.message);
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private decimal(value: unknown): string | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : null;
  }

  private integer(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
