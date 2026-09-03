import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { GetMarketOverviewUseCase } from './application/use-cases/get-market-overview.use-case';
import { GetBitcoinMarketUseCase } from './application/use-cases/get-bitcoin-market.use-case';
import {
  GET_MARKET_OVERVIEW_USE_CASE,
  GLOBAL_MARKET_DATA_PORT
} from './application/interfaces/market-overview.interface';
import {
  BITCOIN_MARKET_PORT,
  GET_BITCOIN_MARKET_USE_CASE
} from './application/interfaces/bitcoin-market.interface';
import { CoinGeckoGlobalMarketProvider } from './infrastructure/coingecko/global-market.provider';
import { CoinGeckoBitcoinMarketProvider } from './infrastructure/coingecko/bitcoin-market.provider';
import globalMarketConfig from './infrastructure/coingecko/global-market.config';
import { MarketOverviewCacheService } from './infrastructure/cache/market-overview-cache.service';
import { BitcoinCacheService } from './infrastructure/cache/bitcoin-cache.service';
import { MarketOverviewController } from './presentation/controllers/market-overview.controller';
import { BitcoinMarketController } from './presentation/controllers/bitcoin-market.controller';

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
  controllers: [MarketOverviewController, BitcoinMarketController],
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
    },
    CoinGeckoBitcoinMarketProvider,
    {
      provide: BITCOIN_MARKET_PORT,
      useExisting: CoinGeckoBitcoinMarketProvider
    },
    BitcoinCacheService,
    GetBitcoinMarketUseCase,
    {
      provide: GET_BITCOIN_MARKET_USE_CASE,
      useExisting: GetBitcoinMarketUseCase
    }
  ]
})
export class MarketOverviewModule {}
