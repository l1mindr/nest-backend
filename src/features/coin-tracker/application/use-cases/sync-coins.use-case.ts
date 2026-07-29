import { ClockService } from '@infrastructure/services/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { CoinTrackerErrors } from '../../domain/errors/coin-tracker-errors';
import {
  CoinGeckoCoin,
  CoinSyncData,
  COINGECKO_CLIENT,
  COIN_REPOSITORY,
  ICoinGeckoClient,
  ICoinRepository,
  ISyncCoinsUseCase
} from '../interfaces/coin-tracker.interface';

@Injectable()
export class SyncCoinsUseCase implements ISyncCoinsUseCase {
  constructor(
    @Inject(COIN_REPOSITORY)
    private readonly coinRepository: ICoinRepository,
    @Inject(COINGECKO_CLIENT)
    private readonly coingeckoClient: ICoinGeckoClient,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(SyncCoinsUseCase.name);
  }

  async execute(): Promise<void> {
    this.logger.info(
      { event: LogEvent.COIN_SYNC_STARTED },
      'Starting coin synchronization'
    );

    let coins: CoinGeckoCoin[];

    try {
      coins = await this.coingeckoClient.getCoins();
    } catch (error) {
      this.logger.error(
        { event: LogEvent.COIN_SYNC_FAILED, err: error },
        'CoinGecko coin retrieval failed'
      );
      throw CoinTrackerErrors.coingeckoApiError(
        error instanceof Error ? error.message : String(error)
      );
    }

    const coinEntities = this.normalizeCoins(
      coins,
      this.clockService.nowDate()
    );

    if (coinEntities.length === 0) {
      throw CoinTrackerErrors.coingeckoApiError('Coin list was empty');
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.coinRepository.deactivateAll(manager);
        await this.coinRepository.upsertMany(coinEntities, manager);
      });
    } catch (error) {
      this.logger.error(
        { event: LogEvent.COIN_SYNC_FAILED, err: error },
        'Coin synchronization transaction failed'
      );
      throw error;
    }

    this.logger.info(
      {
        event: LogEvent.COIN_SYNC_COMPLETED,
        receivedCount: coins.length,
        synchronizedCount: coinEntities.length
      },
      'Coin synchronization completed'
    );
  }

  private normalizeCoins(
    coins: CoinGeckoCoin[],
    lastSyncedAt: Date
  ): CoinSyncData[] {
    const uniqueCoins = new Map<string, CoinSyncData>();

    for (const coin of coins) {
      if (
        typeof coin.id !== 'string' ||
        typeof coin.symbol !== 'string' ||
        typeof coin.name !== 'string'
      ) {
        continue;
      }

      const id = coin.id.trim().toLowerCase();
      const symbol = coin.symbol.trim().toLowerCase();
      const name = coin.name.trim();

      if (!id || !symbol || !name) continue;

      uniqueCoins.set(id, {
        id,
        symbol,
        name,
        image: typeof coin.image === 'string' ? coin.image : null,
        isActive: true,
        lastSyncedAt
      });
    }

    return [...uniqueCoins.values()];
  }
}
