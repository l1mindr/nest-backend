import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './domain/entities/asset.entity';
import { ListAssetsUseCase } from './application/use-cases/list-assets.use-case';
import { GetAssetUseCase } from './application/use-cases/get-asset.use-case';
import { SyncAssetsUseCase } from './application/use-cases/sync-assets.use-case';
import { CoinGeckoMarketDataProvider } from './infrastructure/coingecko/coingecko.provider';
import coingeckoConfig from './infrastructure/coingecko/coingecko.config';
import { AssetRepository } from './infrastructure/repositories/asset.repository';
import { AssetMapper } from './application/mappers/asset.mapper';
import { AssetSyncProcessor } from './infrastructure/queues/asset-sync.processor';
import { AssetSyncScheduler } from './infrastructure/queues/asset-sync.scheduler';
import { AssetSyncProducer } from './infrastructure/queues/asset-sync.producer';
import { ASSET_SYNC_QUEUE } from './infrastructure/queues/asset-sync.constants';
import {
  ASSET_REPOSITORY,
  GET_ASSET_USE_CASE,
  LIST_ASSETS_USE_CASE,
  MARKET_DATA_PORT,
  SYNC_ASSETS_USE_CASE
} from './application/interfaces/assets.interface';
import { AssetsController } from './presentation/controllers/assets.controller';
import { AssetSyncController } from './presentation/controllers/asset-sync.controller';

@Module({
  imports: [
    ConfigModule.forFeature(coingeckoConfig),
    TypeOrmModule.forFeature([Asset]),
    HttpModule.registerAsync({
      imports: [ConfigModule.forFeature(coingeckoConfig)],
      inject: [coingeckoConfig.KEY],
      useFactory: (config: ConfigType<typeof coingeckoConfig>) => ({
        timeout: config.timeoutMs,
        maxRedirects: 0
      })
    }),
    BullModule.registerQueue({ name: ASSET_SYNC_QUEUE })
  ],
  controllers: [AssetsController, AssetSyncController],
  providers: [
    CoinGeckoMarketDataProvider,
    { provide: MARKET_DATA_PORT, useExisting: CoinGeckoMarketDataProvider },
    AssetRepository,
    { provide: ASSET_REPOSITORY, useExisting: AssetRepository },
    SyncAssetsUseCase,
    {
      provide: SYNC_ASSETS_USE_CASE,
      useExisting: SyncAssetsUseCase
    },
    GetAssetUseCase,
    { provide: GET_ASSET_USE_CASE, useExisting: GetAssetUseCase },
    ListAssetsUseCase,
    { provide: LIST_ASSETS_USE_CASE, useExisting: ListAssetsUseCase },
    AssetMapper,
    AssetSyncProcessor,
    AssetSyncScheduler,
    AssetSyncProducer
  ],
  exports: [ASSET_REPOSITORY]
})
export class AssetsModule {}
