import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { CoinGeckoApiClient } from '../coingecko.client';

describe('CoinGeckoApiClient', () => {
  const httpService = {
    get: jest.fn()
  };

  let client: CoinGeckoApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new CoinGeckoApiClient(httpService as unknown as HttpService);
  });

  it('should retrieve the supported coin list', async () => {
    const coins = [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }];
    httpService.get.mockReturnValue(of({ data: coins }));

    await expect(client.getCoins()).resolves.toEqual(coins);
    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/coins/list'
    );
  });

  it('should retrieve prices for all provided ids in one request', async () => {
    const prices = {
      bitcoin: { usd: 120000 },
      ethereum: { usd: 5000 }
    };
    httpService.get.mockReturnValue(of({ data: prices }));

    await expect(client.getPrices(['bitcoin', 'ethereum'])).resolves.toEqual(
      prices
    );
    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd'
        }
      }
    );
  });

  it('should avoid an HTTP request for an empty price batch', async () => {
    await expect(client.getPrices([])).resolves.toEqual({});
    expect(httpService.get).not.toHaveBeenCalled();
  });
});
