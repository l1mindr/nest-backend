import { Coin } from '../../../entities/coin.entity';
import { CoinSortField } from '../../../enums/coin-sort-field.enum';
import { SortOrder } from '../../../enums/sort-order.enum';
import { CoinTrackerErrorCode } from '../../../errors/coin-tracker-error-code.enum';
import { CoinCursorService } from '../coin-cursor.service';

describe('CoinCursorService', () => {
  const service = new CoinCursorService();
  const coin = {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC'
  } as Coin;

  it('should encode and decode a cursor for the selected sort', () => {
    const cursor = service.encode(coin, CoinSortField.NAME, SortOrder.DESC);

    expect(service.decode(cursor, CoinSortField.NAME, SortOrder.DESC)).toEqual({
      sortBy: CoinSortField.NAME,
      sortOrder: SortOrder.DESC,
      value: 'bitcoin',
      id: 'bitcoin'
    });
  });

  it('should reject a cursor reused with different sorting', () => {
    const cursor = service.encode(coin, CoinSortField.NAME, SortOrder.ASC);

    expect(() =>
      service.decode(cursor, CoinSortField.SYMBOL, SortOrder.ASC)
    ).toThrow(
      expect.objectContaining({
        code: CoinTrackerErrorCode.INVALID_CURSOR
      })
    );
  });
});
