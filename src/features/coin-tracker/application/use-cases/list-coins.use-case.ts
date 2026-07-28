import { paginate } from '@core/pagination/paginate.util';
import { Inject, Injectable } from '@nestjs/common';
import { COIN_PAGE_SIZE_DEFAULT } from '../../presentation/dto/request/coin-list.request.dto';
import { Coin } from '../../domain/entities/coin.entity';
import { CoinSortField } from '../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../domain/enums/sort-order.enum';
import {
  COIN_CURSOR_SERVICE,
  COIN_REPOSITORY,
  ICoinCursorService,
  ICoinRepository,
  IListCoinsUseCase
} from '../interfaces/coin-tracker.interface';

@Injectable()
export class ListCoinsUseCase implements IListCoinsUseCase {
  constructor(
    @Inject(COIN_REPOSITORY)
    private readonly coinRepository: ICoinRepository,
    @Inject(COIN_CURSOR_SERVICE)
    private readonly cursorService: ICoinCursorService
  ) {}

  async execute(options: {
    search?: string;
    cursor?: string;
    limit?: number;
    sortBy?: CoinSortField;
    sortOrder?: SortOrder;
  }) {
    const pageSize = options.limit ?? COIN_PAGE_SIZE_DEFAULT;
    const sortBy = options.sortBy ?? CoinSortField.ID;
    const sortOrder = options.sortOrder ?? SortOrder.ASC;
    const cursor = this.cursorService.decode(options.cursor, sortBy, sortOrder);

    const coins = await this.coinRepository.search({
      search: options.search ?? '',
      cursor,
      limit: pageSize + 1,
      sortBy,
      sortOrder
    });

    return paginate<Coin>(coins, pageSize, (coin) =>
      this.cursorService.encode(coin, sortBy, sortOrder)
    );
  }
}
