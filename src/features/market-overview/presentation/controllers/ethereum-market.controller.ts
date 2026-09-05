import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  GET_COIN_MARKET_USE_CASE,
  IGetCoinMarketUseCase,
  TICKER_COIN_IDS
} from '../../application/interfaces/coin-market.interface';
import { CoinMarketResponseDto } from '../dto/response/coin-market.response.dto';
import { ApiGetEthereumMarket } from '../swagger/ethereum-market.swagger';

/**
 * Live Ethereum/USD ticker. Identical in shape and freshness to the Bitcoin
 * route — the two dashboard price tiles sit side by side, so they share one
 * provider, one cache policy and one response DTO rather than one being live
 * and the other read from the hourly `assets` catalogue.
 */
@Controller({
  path: 'market/ethereum',
  version: '1'
})
@ApiTags(ApiTagName.MARKET)
export class EthereumMarketController {
  constructor(
    @Inject(GET_COIN_MARKET_USE_CASE)
    private readonly getCoinMarketUseCase: IGetCoinMarketUseCase
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetEthereumMarket()
  async getEthereum() {
    const ethereum = await this.getCoinMarketUseCase.execute(
      TICKER_COIN_IDS.ETHEREUM
    );

    return plainToInstance(CoinMarketResponseDto, ethereum, {
      excludeExtraneousValues: true
    });
  }
}
