import { Coin } from '../../../domain/entities/coin.entity';
import { PriceAlert } from '../../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { CoinSortField } from '../../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../../domain/enums/sort-order.enum';
import { CoinTrackerErrorCode } from '../../../domain/errors/coin-tracker-error-code.enum';
import { ListCoinsUseCase } from '../list-coins.use-case';
import { ListPriceAlertsUseCase } from '../list-price-alerts.use-case';

describe('Coin Tracker list use cases', () => {
  describe('ListCoinsUseCase', () => {
    const coinRepository = {
      search: jest.fn()
    };
    const cursorService = {
      decode: jest.fn(),
      encode: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
      cursorService.decode.mockReturnValue(null);
      cursorService.encode.mockReturnValue('next-coin-cursor');
    });

    it('should apply defaults and return a cursor when another page exists', async () => {
      const coins = Array.from({ length: 21 }, (_, index) => ({
        id: `coin-${String(index).padStart(2, '0')}`
      })) as Coin[];
      coinRepository.search.mockResolvedValue(coins);
      const useCase = new ListCoinsUseCase(
        coinRepository as any,
        cursorService as any
      );

      const result = await useCase.execute({});

      expect(coinRepository.search).toHaveBeenCalledWith({
        search: '',
        cursor: null,
        limit: 21,
        sortBy: CoinSortField.ID,
        sortOrder: SortOrder.ASC
      });
      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe('next-coin-cursor');
      expect(cursorService.encode).toHaveBeenCalledWith(
        coins[19],
        CoinSortField.ID,
        SortOrder.ASC
      );
    });
  });

  describe('ListPriceAlertsUseCase', () => {
    const priceAlertRepository = {
      listByUser: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should scope filters to the current user and paginate results', async () => {
      const alerts = [
        { id: '2ca4c45d-a1c3-41d4-a729-dd3532e9f61b' },
        { id: '41b408d1-3873-43c7-a113-1e797f21f2f0' }
      ] as PriceAlert[];
      priceAlertRepository.listByUser.mockResolvedValue(alerts);
      const useCase = new ListPriceAlertsUseCase(priceAlertRepository as any);

      const result = await useCase.execute('user-id', {
        limit: 1,
        status: AlertStatus.ACTIVE,
        direction: AlertDirection.BUY,
        coinId: 'bitcoin'
      });

      expect(priceAlertRepository.listByUser).toHaveBeenCalledWith('user-id', {
        cursorId: null,
        limit: 2,
        status: AlertStatus.ACTIVE,
        direction: AlertDirection.BUY,
        coinId: 'bitcoin'
      });
      expect(result.items).toEqual([alerts[0]]);
      expect(result.nextCursor).toBe(
        Buffer.from(alerts[0].id, 'utf-8').toString('base64url')
      );
    });

    it('should reject malformed alert cursors', async () => {
      const useCase = new ListPriceAlertsUseCase(priceAlertRepository as any);

      await expect(
        useCase.execute('user-id', { cursor: 'not-a-valid-cursor' })
      ).rejects.toMatchObject({
        code: CoinTrackerErrorCode.INVALID_CURSOR
      });
      expect(priceAlertRepository.listByUser).not.toHaveBeenCalled();
    });
  });
});
