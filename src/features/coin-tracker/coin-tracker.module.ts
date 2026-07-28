import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoinGeckoApiClient } from './coingecko/coingecko.client';
import { ListCoinsUseCase } from './application/use-cases/list-coins.use-case';
import { SyncCoinsUseCase } from './application/use-cases/sync-coins.use-case';
import { CreatePriceAlertUseCase } from './application/use-cases/create-price-alert.use-case';
import { UpdatePriceAlertUseCase } from './application/use-cases/update-price-alert.use-case';
import { CancelPriceAlertUseCase } from './application/use-cases/cancel-price-alert.use-case';
import { ListPriceAlertsUseCase } from './application/use-cases/list-price-alerts.use-case';
import { PriceCheckService } from './application/services/price-check.service';
import { CoinCursorService } from './application/services/coin-cursor.service';
import { PriceAlertEvaluatorService } from './application/services/price-alert-evaluator.service';
import { CoinMapper } from './application/mappers/coin.mapper';
import { PriceAlertMapper } from './application/mappers/price-alert.mapper';
import { Coin } from './entities/coin.entity';
import { PriceAlert } from './entities/price-alert.entity';
import {
  COIN_REPOSITORY,
  PRICE_ALERT_REPOSITORY,
  LIST_COINS_USE_CASE,
  SYNC_COINS_USE_CASE,
  CREATE_PRICE_ALERT_USE_CASE,
  UPDATE_PRICE_ALERT_USE_CASE,
  CANCEL_PRICE_ALERT_USE_CASE,
  LIST_PRICE_ALERTS_USE_CASE,
  PRICE_CHECK_SERVICE,
  NOTIFICATION_SERVICE,
  COINGECKO_CLIENT,
  COIN_CURSOR_SERVICE
} from './interfaces/coin-tracker.interface';
import { CoinRepository } from './repositories/coin.repository';
import { PriceAlertRepository } from './repositories/price-alert.repository';
import { LoggerNotificationService } from './notifications/logger-notification.service';
import { CoinsController } from './coins.controller';
import { PriceAlertsController } from './price-alerts.controller';
import { CoinSyncScheduler } from './schedulers/coin-sync.scheduler';
import { PriceCheckScheduler } from './schedulers/price-check.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coin, PriceAlert]),
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0
    }),
    ScheduleModule.forRoot()
  ],
  controllers: [CoinsController, PriceAlertsController],
  providers: [
    CoinRepository,
    { provide: COIN_REPOSITORY, useExisting: CoinRepository },
    PriceAlertRepository,
    { provide: PRICE_ALERT_REPOSITORY, useExisting: PriceAlertRepository },
    CoinCursorService,
    { provide: COIN_CURSOR_SERVICE, useExisting: CoinCursorService },
    CoinGeckoApiClient,
    { provide: COINGECKO_CLIENT, useExisting: CoinGeckoApiClient },
    LoggerNotificationService,
    { provide: NOTIFICATION_SERVICE, useExisting: LoggerNotificationService },
    ListCoinsUseCase,
    { provide: LIST_COINS_USE_CASE, useExisting: ListCoinsUseCase },
    SyncCoinsUseCase,
    { provide: SYNC_COINS_USE_CASE, useExisting: SyncCoinsUseCase },
    CreatePriceAlertUseCase,
    {
      provide: CREATE_PRICE_ALERT_USE_CASE,
      useExisting: CreatePriceAlertUseCase
    },
    UpdatePriceAlertUseCase,
    {
      provide: UPDATE_PRICE_ALERT_USE_CASE,
      useExisting: UpdatePriceAlertUseCase
    },
    CancelPriceAlertUseCase,
    {
      provide: CANCEL_PRICE_ALERT_USE_CASE,
      useExisting: CancelPriceAlertUseCase
    },
    ListPriceAlertsUseCase,
    {
      provide: LIST_PRICE_ALERTS_USE_CASE,
      useExisting: ListPriceAlertsUseCase
    },
    PriceCheckService,
    { provide: PRICE_CHECK_SERVICE, useExisting: PriceCheckService },
    PriceAlertEvaluatorService,
    CoinMapper,
    PriceAlertMapper,
    CoinSyncScheduler,
    PriceCheckScheduler
  ],
  exports: [COIN_REPOSITORY, PRICE_ALERT_REPOSITORY, SYNC_COINS_USE_CASE]
})
export class CoinTrackerModule {}
