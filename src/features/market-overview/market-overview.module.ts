import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { GetMarketOverviewUseCase } from './application/use-cases/get-market-overview.use-case';
import {
  GET_MARKET_OVERVIEW_USE_CASE,
  GLOBAL_MARKET_DATA_PORT
} from './application/interfaces/market-overview.interface';
import { CoinGeckoGlobalMarketProvider } from './infrastructure/coingecko/global-market.provider';
import globalMarketConfig from './infrastructure/coingecko/global-market.config';
import { MarketOverviewCacheService } from './infrastructure/cache/market-overview-cache.service';
import { MarketOverviewController } from './presentation/controllers/market-overview.controller';

@Module({
  imports: [
    ConfigModule.forFeature(globalMarketConfig),
    HttpModule.registerAsync({
      imports: [ConfigModule.forFeature(globalMarketConfig)],
      inject: [globalMarketConfig.KEY],
      useFactory: (config: ConfigType<typeof globalMarketConfig>) => ({
        timeout: config.timeoutMs,
        maxRedirects: 0
      })
    })
  ],
  controllers: [MarketOverviewController],
  providers: [
    CoinGeckoGlobalMarketProvider,
    {
      provide: GLOBAL_MARKET_DATA_PORT,
      useExisting: CoinGeckoGlobalMarketProvider
    },
    MarketOverviewCacheService,
    GetMarketOverviewUseCase,
    {
      provide: GET_MARKET_OVERVIEW_USE_CASE,
      useExisting: GetMarketOverviewUseCase
    }
  ]
})
export class MarketOverviewModule {}
