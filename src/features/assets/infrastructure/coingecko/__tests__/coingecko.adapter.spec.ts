import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CoinGeckoAdapter } from '../coingecko.adapter';

describe('CoinGeckoAdapter', () => {
  const httpService = {
    get: jest.fn()
  };
  const config: {
    baseUrl: string;
    apiKey: string | null;
    pageSize: number;
    maxPages: number;
  } = {
    baseUrl: 'https://api.coingecko.com/api/v3',
    apiKey: null,
    pageSize: 2,
    maxPages: 5
  };

  let adapter: CoinGeckoAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    httpService.get.mockReset();
    config.apiKey = null;
    config.pageSize = 2;
    config.maxPages = 5;
    adapter = new CoinGeckoAdapter(
      httpService as unknown as HttpService,
      config as any
    );
  });

  it('should fetch paginated market data', async () => {
    const page1 = [{ id: 'bitcoin' }, { id: 'ethereum' }];
    const page2 = [{ id: 'solana' }, { id: 'cardano' }];
    httpService.get
      .mockReturnValueOnce(of({ data: page1 }))
      .mockReturnValueOnce(of({ data: page2 }))
      .mockReturnValueOnce(of({ data: [] }));

    const result = await adapter.fetchMarketData();

    expect(result).toEqual([...page1, ...page2]);
    expect(httpService.get).toHaveBeenCalledTimes(3);
    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        headers: undefined,
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 2,
          page: 1
        }
      }
    );
    expect(httpService.get).toHaveBeenLastCalledWith(
      'https://api.coingecko.com/api/v3/coins/markets',
      expect.objectContaining({
        params: expect.objectContaining({ page: 3 })
      })
    );
  });

  it('should stop when a page returns fewer items than pageSize', async () => {
    const page1 = [{ id: 'bitcoin' }, { id: 'ethereum' }];
    httpService.get
      .mockReturnValueOnce(of({ data: page1 }))
      .mockReturnValueOnce(of({ data: [{ id: 'solana' }] }));

    const result = await adapter.fetchMarketData();

    expect(result).toEqual([...page1, { id: 'solana' }]);
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('should respect maxPages limit', async () => {
    const fullPage = [{ id: 'bitcoin' }, { id: 'ethereum' }];
    httpService.get.mockReturnValue(of({ data: fullPage }));

    config.maxPages = 3;
    const result = await adapter.fetchMarketData();

    expect(result).toHaveLength(6);
    expect(httpService.get).toHaveBeenCalledTimes(3);
    expect(httpService.get).toHaveBeenLastCalledWith(
      'https://api.coingecko.com/api/v3/coins/markets',
      expect.objectContaining({
        params: expect.objectContaining({ page: 3 })
      })
    );
  });

  it('should include API key header when configured', async () => {
    config.apiKey = 'secret-key';
    httpService.get.mockReturnValue(of({ data: [] }));

    await adapter.fetchMarketData();

    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/coins/markets',
      expect.objectContaining({
        headers: { 'x-cg-demo-api-key': 'secret-key' }
      })
    );
  });

  it('should handle HTTP errors', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('rate limited'))
    );

    await expect(adapter.fetchMarketData()).rejects.toThrow('rate limited');
  });
});
