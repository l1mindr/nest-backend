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
import { WallexUsdtTomanProvider } from './infrastructure/wallex/usdt-toman.provider';
import { FailoverUsdtTomanProvider } from './infrastructure/usdt-toman/failover-usdt-toman.provider';
import globalMarketConfig from './infrastructure/coingecko/global-market.config';
import nobitexUsdtTomanConfig from './infrastructure/nobitex/usdt-toman.config';
import wallexUsdtTomanConfig from './infrastructure/wallex/usdt-toman.config';
import usdtTomanConfig from './infrastructure/usdt-toman/usdt-toman.config';
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
    ConfigModule.forFeature(wallexUsdtTomanConfig),
    ConfigModule.forFeature(usdtTomanConfig),
    // One HTTP client for the module. The per-request `timeout` each provider
    // passes wins over this default, so the exchange calls are not bound to the
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
    // Both exchanges are registered concretely, but only the failover chain is
    // bound to the port: nothing above infrastructure gets to pick a venue, so
    // switching `USDT_TOMAN_PROVIDER` is the only way to change the order.
    NobitexUsdtTomanProvider,
    WallexUsdtTomanProvider,
    FailoverUsdtTomanProvider,
    {
      provide: USDT_TOMAN_PORT,
      useExisting: FailoverUsdtTomanProvider
    },
    UsdtTomanCacheService,
    GetUsdtTomanUseCase,
    {
      provide: GET_USDT_TOMAN_USE_CASE,
      useExisting: GetUsdtTomanUseCase
    }
  ],
  // The USDT/Toman rate is the only thing another feature needs from here: the
  // portfolio converts a Toman-entered transaction price with it. Exporting
  // the use case rather than a provider keeps the cache and the failover chain
  // on this side of the boundary, so there is still exactly one path to an
  // exchange.
  exports: [GET_USDT_TOMAN_USE_CASE]
})
export class MarketOverviewModule {}
