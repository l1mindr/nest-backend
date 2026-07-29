import { ClockService } from '@infrastructure/services/clock.service';
import { DataSource } from 'typeorm';
import { CoinTrackerErrorCode } from '../../../domain/errors/coin-tracker-error-code.enum';
import { SyncCoinsUseCase } from '../sync-coins.use-case';

describe('SyncCoinsUseCase', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  const manager = { id: 'manager' };
  const coinRepository = {
    deactivateAll: jest.fn(),
    upsertMany: jest.fn()
  };
  const coingeckoClient = {
    getCoins: jest.fn()
  };
  const clockService = {
    nowDate: jest.fn()
  };
  const dataSource = {
    transaction: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  let useCase: SyncCoinsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(now);
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager)
    );

    useCase = new SyncCoinsUseCase(
      coinRepository as any,
      coingeckoClient as any,
      clockService as unknown as ClockService,
      dataSource as unknown as DataSource,
      logger as any
    );
  });

  it('should deduplicate and synchronize coins in one transaction', async () => {
    coingeckoClient.getCoins.mockResolvedValue([
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin Updated' },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
      { id: 123, symbol: 'BAD', name: 'Malformed' },
      { id: '', symbol: '', name: '' }
    ]);

    await useCase.execute();

    expect(coinRepository.deactivateAll).toHaveBeenCalledWith(manager);
    expect(coinRepository.upsertMany).toHaveBeenCalledWith(
      [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin Updated',
          image: null,
          isActive: true,
          lastSyncedAt: now
        },
        {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          image: null,
          isActive: true,
          lastSyncedAt: now
        }
      ],
      manager
    );
  });

  it('should reject an empty upstream list without deactivating local coins', async () => {
    coingeckoClient.getCoins.mockResolvedValue([]);

    await expect(useCase.execute()).rejects.toMatchObject({
      code: CoinTrackerErrorCode.COINGECKO_API_ERROR
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should map upstream failures to the CoinGecko error convention', async () => {
    coingeckoClient.getCoins.mockRejectedValue(new Error('timeout'));

    await expect(useCase.execute()).rejects.toMatchObject({
      code: CoinTrackerErrorCode.COINGECKO_API_ERROR
    });
  });

  it('should preserve database failures', async () => {
    const error = new Error('database unavailable');
    coingeckoClient.getCoins.mockResolvedValue([
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }
    ]);
    dataSource.transaction.mockRejectedValue(error);

    await expect(useCase.execute()).rejects.toBe(error);
  });
});
