import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import {
  ICoinGeckoClient,
  CoinGeckoCoin,
  CoinGeckoPrice
} from '../../application/interfaces/coin-tracker.interface';

@Injectable()
export class CoinGeckoApiClient implements ICoinGeckoClient {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(private readonly httpService: HttpService) {}

  async getCoins(): Promise<CoinGeckoCoin[]> {
    const response = await firstValueFrom(
      this.httpService.get<CoinGeckoCoin[]>(`${this.baseUrl}/coins/list`)
    );

    return response.data;
  }

  async getPrices(ids: string[]): Promise<CoinGeckoPrice> {
    if (ids.length === 0) return {};

    const response = await firstValueFrom(
      this.httpService.get<CoinGeckoPrice>(`${this.baseUrl}/simple/price`, {
        params: {
          ids: ids.join(','),
          vs_currencies: 'usd'
        }
      })
    );

    return response.data;
  }
}
