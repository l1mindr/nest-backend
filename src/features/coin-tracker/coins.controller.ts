import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CoinListRequestDto } from './dto/request/coin-list.request.dto';
import { CoinMapper } from './application/mappers/coin.mapper';
import {
  IListCoinsUseCase,
  LIST_COINS_USE_CASE
} from './interfaces/coin-tracker.interface';
import { ApiGetCoins } from './coin-tracker.swagger';

@Controller({
  path: 'coins',
  version: '1'
})
@ApiTags('coins')
export class CoinsController {
  constructor(
    @Inject(LIST_COINS_USE_CASE)
    private readonly listCoinsUseCase: IListCoinsUseCase,
    private readonly coinMapper: CoinMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetCoins()
  async listCoins(@Query() query: CoinListRequestDto) {
    const { items, nextCursor } = await this.listCoinsUseCase.execute({
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    });

    return {
      items: this.coinMapper.toResponseList(items),
      nextCursor
    };
  }
}
