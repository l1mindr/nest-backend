import { decodeCursor, encodeCursor } from '@core/pagination/cursor.util';
import { Injectable } from '@nestjs/common';
import { Coin } from '../../domain/entities/coin.entity';
import { CoinSortField } from '../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../domain/enums/sort-order.enum';
import { CoinTrackerErrors } from '../../domain/errors/coin-tracker-errors';
import {
  CoinCursor,
  ICoinCursorService
} from '../interfaces/coin-tracker.interface';

@Injectable()
export class CoinCursorService implements ICoinCursorService {
  encode(coin: Coin, sortBy: CoinSortField, sortOrder: SortOrder): string {
    const value =
      sortBy === CoinSortField.ID
        ? coin.id
        : String(coin[sortBy]).toLowerCase();

    return encodeCursor(
      JSON.stringify({
        sortBy,
        sortOrder,
        value,
        id: coin.id
      } satisfies CoinCursor)
    );
  }

  decode(
    cursor: string | undefined,
    sortBy: CoinSortField,
    sortOrder: SortOrder
  ): CoinCursor | null {
    if (!cursor) return null;

    try {
      const payload = JSON.parse(decodeCursor(cursor)) as unknown;

      if (!this.isValid(payload, sortBy, sortOrder)) {
        throw CoinTrackerErrors.invalidCursor();
      }

      return payload;
    } catch {
      throw CoinTrackerErrors.invalidCursor();
    }
  }

  private isValid(
    payload: unknown,
    sortBy: CoinSortField,
    sortOrder: SortOrder
  ): payload is CoinCursor {
    if (typeof payload !== 'object' || payload === null) return false;

    const candidate = payload as Record<string, unknown>;

    return (
      candidate.sortBy === sortBy &&
      candidate.sortOrder === sortOrder &&
      typeof candidate.value === 'string' &&
      candidate.value.length > 0 &&
      typeof candidate.id === 'string' &&
      candidate.id.length > 0
    );
  }
}
