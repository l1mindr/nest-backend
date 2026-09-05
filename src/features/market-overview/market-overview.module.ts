import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { GetMarketOverviewUseCase } from './application/use-cases/get-market-overview.use-case';
import { GetCoinMarketUseCase } from './application/use-cases/get-coin-market.use-case';
import { GetUsdtTomanUseCase } from './application/use-cases/get-usdt-toman.use-case';
import {
  GET_MARKET_OVERVIEW_USE_CASE,
  GLOBAL_MARKET_DATA_PORT
} from './application/interfaces/market-overview.interface';
import {
  COIN_MARKET_PORT,
  GET_COIN_MARKET_USE_CASE
} from './application/interfaces/coin-market.interface';
import {
  GET_USDT_TOMAN_USE_CASE,
  USDT_TOMAN_PORT
} from './application/interfaces/usdt-toman.interface';
import { CoinGeckoGlobalMarketProvider } from './infrastructure/coingecko/global-market.provider';
import { CoinGeckoCoinMarketProvider } from './infrastructure/coingecko/coin-market.provider';
import { NobitexUsdtTomanProvider } from './infrastructure/nobitex/usdt-toman.provider';
import globalMarketConfig from './infrastructure/coingecko/global-market.config';
import nobitexUsdtTomanConfig from './infrastructure/nobitex/usdt-toman.config';
import { MarketOverviewCacheService } from './infrastructure/cache/market-overview-cache.service';
import { CoinMarketCacheService } from './infrastructure/cache/coin-market-cache.service';
import { UsdtTomanCacheService } from './infrastructure/cache/usdt-toman-cache.service';
import { MarketOverviewController } from './presentation/controllers/market-overview.controller';
import { BitcoinMarketController } from './presentation/controllers/bitcoin-market.controller';
import { EthereumMarketController } from './presentation/controllers/ethereum-market.controller';
import { UsdtTomanController } from './presentation/controllers/usdt-toman.controller';

@Module({
  imports: [
    ConfigModule.forFeature(globalMarketConfig),
    ConfigModule.forFeature(nobitexUsdtTomanConfig),
    // One HTTP client for the module. The per-request `timeout` each provider
    // passes wins over this default, so the Nobitex calls are not bound to the
    // CoinGecko timeout despite sharing the client.
    HttpModule.registerAsync({
      imports: [ConfigModule.forFeature(globalMarketConfig)],
      inject: [globalMarketConfig.KEY],
      useFactory: (config: ConfigType<typeof globalMarketConfig>) => ({
        timeout: config.timeoutMs,
        maxRedirects: 0
      })
    })
  ],
  controllers: [
    MarketOverviewController,
    BitcoinMarketController,
    EthereumMarketController,
    UsdtTomanController
  ],
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
    CoinGeckoCoinMarketProvider,
    {
      provide: COIN_MARKET_PORT,
      useExisting: CoinGeckoCoinMarketProvider
    },
    CoinMarketCacheService,
    GetCoinMarketUseCase,
    {
      provide: GET_COIN_MARKET_USE_CASE,
      useExisting: GetCoinMarketUseCase
    },
    NobitexUsdtTomanProvider,
    {
      provide: USDT_TOMAN_PORT,
      useExisting: NobitexUsdtTomanProvider
    },
    UsdtTomanCacheService,
    GetUsdtTomanUseCase,
    {
      provide: GET_USDT_TOMAN_USE_CASE,
      useExisting: GetUsdtTomanUseCase
    }
  ]
})
export class MarketOverviewModule {}
