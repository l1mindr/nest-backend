import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './domain/entities/asset.entity';
import { ListAssetsUseCase } from './application/use-cases/list-assets.use-case';
import { GetAssetUseCase } from './application/use-cases/get-asset.use-case';
import { SyncAssetsFromCoinGeckoUseCase } from './application/use-cases/sync-assets-from-coingecko.use-case';
import { CoinGeckoAdapter } from './infrastructure/coingecko/coingecko.adapter';
import coingeckoConfig from './infrastructure/coingecko/coingecko.config';
import { AssetRepository } from './infrastructure/repositories/asset.repository';
import { AssetMapper } from './application/mappers/asset.mapper';
import { AssetSyncProcessor } from './infrastructure/queues/asset-sync.processor';
import { AssetSyncScheduler } from './infrastructure/queues/asset-sync.scheduler';
import { ASSET_SYNC_QUEUE } from './infrastructure/queues/asset-sync.constants';
import {
  ASSET_REPOSITORY,
  COINGECKO_PORT,
  GET_ASSET_USE_CASE,
  LIST_ASSETS_USE_CASE,
  SYNC_ASSETS_USE_CASE
} from './application/interfaces/assets.interface';
import { AssetsController } from './presentation/controllers/assets.controller';
import { AssetSyncController } from './presentation/controllers/asset-sync.controller';

@Module({
  imports: [
    ConfigModule.forFeature(coingeckoConfig),
    TypeOrmModule.forFeature([Asset]),
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 0
    }),
    BullModule.registerQueue({ name: ASSET_SYNC_QUEUE })
  ],
  controllers: [AssetsController, AssetSyncController],
  providers: [
    CoinGeckoAdapter,
    { provide: COINGECKO_PORT, useExisting: CoinGeckoAdapter },
    AssetRepository,
    { provide: ASSET_REPOSITORY, useExisting: AssetRepository },
    SyncAssetsFromCoinGeckoUseCase,
    {
      provide: SYNC_ASSETS_USE_CASE,
      useExisting: SyncAssetsFromCoinGeckoUseCase
    },
    GetAssetUseCase,
    { provide: GET_ASSET_USE_CASE, useExisting: GetAssetUseCase },
    ListAssetsUseCase,
    { provide: LIST_ASSETS_USE_CASE, useExisting: ListAssetsUseCase },
    AssetMapper,
    AssetSyncProcessor,
    AssetSyncScheduler
  ]
})
export class AssetsModule {}
