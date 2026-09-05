import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  GET_MARKET_OVERVIEW_USE_CASE,
  IGetMarketOverviewUseCase
} from '../../application/interfaces/market-overview.interface';
import { MarketOverviewResponseDto } from '../dto/response/market-overview.response.dto';
import { ApiGetMarketOverview } from '../swagger/market-overview.swagger';

/**
 * Total crypto market snapshot (global market cap, its 24h change, BTC
 * dominance), synchronised from CoinGecko. `JwtGuard` is registered globally,
 * so this route requires a valid `access_token` cookie and nothing more.
 */
@Controller({
  path: 'market/overview',
  version: '1'
})
@ApiTags(ApiTagName.MARKET)
export class MarketOverviewController {
  constructor(
    @Inject(GET_MARKET_OVERVIEW_USE_CASE)
    private readonly getMarketOverviewUseCase: IGetMarketOverviewUseCase
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetMarketOverview()
  async getOverview() {
    const overview = await this.getMarketOverviewUseCase.execute();

    return plainToInstance(MarketOverviewResponseDto, overview, {
      excludeExtraneousValues: true
    });
  }
}
