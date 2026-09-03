import { AppError } from '@core/errors/app.error';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import {
  FearGreedEntry,
  FearGreedPort
} from '../../application/interfaces/market-sentiment.interface';
import { MarketSentimentErrors } from '../../domain/errors/market-sentiment-errors';
import fearGreedConfig from './fear-greed.config';

/**
 * The raw shape alternative.me returns from `/fng/`. Deliberately private to
 * this adapter — nothing outside infrastructure may depend on the wire
 * format. `value`, `timestamp` and `time_until_update` are documented by the
 * provider as numeric strings.
 */
interface FearGreedRecord {
  value?: unknown;
  value_classification?: unknown;
  timestamp?: unknown;
  time_until_update?: unknown;
}

interface ClassifiedError {
  permanent: boolean;
  error: Error;
}

@Injectable()
export class AlternativeMeFearGreedProvider implements FearGreedPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(fearGreedConfig.KEY)
    private readonly config: ConfigType<typeof fearGreedConfig>,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(AlternativeMeFearGreedProvider.name);
  }

  /**
   * Fetches the current Fear & Greed Index value. Transient failures (rate
   * limit, timeout, 5xx, network) are retried with exponential backoff;
   * permanent rejections (unexpected 4xx, malformed body) fail immediately.
   */
  async fetchFearGreedIndex(): Promise<FearGreedEntry> {
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
            'Fear & Greed request failed and will be retried'
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError ?? MarketSentimentErrors.providerUnavailable();
  }

  private async request(): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>(`${this.config.baseUrl}/`, {
        timeout: this.config.timeoutMs,
        params: { limit: 1 }
      })
    );

    return response.data;
  }

  /**
   * Maps the raw alternative.me payload onto the provider-neutral
   * {@link FearGreedEntry} shape. `data` must be a non-empty array whose
   * first record carries a numeric `value` and a `value_classification`
   * string — anything else is an invalid response, a hard failure since
   * there is exactly one record to parse.
   */
  private normalize(payload: unknown): FearGreedEntry {
    const record = this.record(payload);

    const value = this.number(record.value);
    const classification = this.string(record.value_classification);
    const timestampSeconds = this.number(record.timestamp);

    if (value === null || !classification || timestampSeconds === null) {
      throw MarketSentimentErrors.providerInvalidResponse();
    }

    const timeUntilUpdateSeconds = this.number(record.time_until_update);

    return {
      value,
      classification,
      updatedAt: new Date(timestampSeconds * 1000),
      nextUpdateAt:
        timeUntilUpdateSeconds === null
          ? null
          : new Date(Date.now() + timeUntilUpdateSeconds * 1000)
    };
  }

  private record(payload: unknown): FearGreedRecord {
    if (typeof payload !== 'object' || payload === null) {
      throw MarketSentimentErrors.providerInvalidResponse();
    }

    const data = (payload as { data?: unknown }).data;

    if (!Array.isArray(data) || data.length === 0) {
      throw MarketSentimentErrors.providerInvalidResponse();
    }

    const [first] = data;

    if (typeof first !== 'object' || first === null) {
      throw MarketSentimentErrors.providerInvalidResponse();
    }

    return first as FearGreedRecord;
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
          error: MarketSentimentErrors.providerRateLimited()
        };
      }

      if (status && status >= 500) {
        return {
          permanent: false,
          error: MarketSentimentErrors.providerUnavailable()
        };
      }

      if (status) {
        return {
          permanent: true,
          error: MarketSentimentErrors.providerBadRequest()
        };
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          permanent: false,
          error: MarketSentimentErrors.providerTimeout()
        };
      }
    }

    return {
      permanent: false,
      error: MarketSentimentErrors.providerUnavailable()
    };
  }

  private number(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
