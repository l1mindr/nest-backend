import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  CoinGeckoMarketData,
  CoinGeckoPort
} from '../../application/interfaces/assets.interface';
import coingeckoConfig from './coingecko.config';

@Injectable()
export class CoinGeckoAdapter implements CoinGeckoPort {
  constructor(
    private readonly httpService: HttpService,
    @Inject(coingeckoConfig.KEY)
    private readonly config: ConfigType<typeof coingeckoConfig>
  ) {}

  async fetchMarketData(): Promise<CoinGeckoMarketData[]> {
    const headers = this.config.apiKey
      ? { 'x-cg-demo-api-key': this.config.apiKey }
      : undefined;

    const marketData: CoinGeckoMarketData[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoMarketData[]>(
          `${this.config.baseUrl}/coins/markets`,
          {
            headers,
            params: {
              vs_currency: 'usd',
              order: 'market_cap_desc',
              per_page: this.config.pageSize,
              page
            }
          }
        )
      );

      marketData.push(...response.data);

      if (response.data.length < this.config.pageSize) break;
    }

    return marketData;
  }
}
