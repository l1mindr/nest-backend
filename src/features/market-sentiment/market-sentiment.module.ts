import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { GetFearGreedUseCase } from './application/use-cases/get-fear-greed.use-case';
import {
  FEAR_GREED_PORT,
  GET_FEAR_GREED_USE_CASE
} from './application/interfaces/market-sentiment.interface';
import { AlternativeMeFearGreedProvider } from './infrastructure/alternativeme/fear-greed.provider';
import fearGreedConfig from './infrastructure/alternativeme/fear-greed.config';
import { FearGreedCacheService } from './infrastructure/cache/fear-greed-cache.service';
import { MarketSentimentController } from './presentation/controllers/market-sentiment.controller';

@Module({
  imports: [
    ConfigModule.forFeature(fearGreedConfig),
    HttpModule.registerAsync({
      imports: [ConfigModule.forFeature(fearGreedConfig)],
      inject: [fearGreedConfig.KEY],
      useFactory: (config: ConfigType<typeof fearGreedConfig>) => ({
        timeout: config.timeoutMs,
        maxRedirects: 0
      })
    })
  ],
  controllers: [MarketSentimentController],
  providers: [
    AlternativeMeFearGreedProvider,
    { provide: FEAR_GREED_PORT, useExisting: AlternativeMeFearGreedProvider },
    FearGreedCacheService,
    GetFearGreedUseCase,
    { provide: GET_FEAR_GREED_USE_CASE, useExisting: GetFearGreedUseCase }
  ]
})
export class MarketSentimentModule {}
