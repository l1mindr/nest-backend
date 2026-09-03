import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  GET_BITCOIN_MARKET_USE_CASE,
  IGetBitcoinMarketUseCase
} from '../../application/interfaces/bitcoin-market.interface';
import { BitcoinMarketResponseDto } from '../dto/response/bitcoin-market.response.dto';
import { ApiGetBitcoinMarket } from '../swagger/bitcoin-market.swagger';

/**
 * Live Bitcoin/USD ticker, synchronised directly from CoinGecko on every
 * cache miss rather than the hourly `assets` catalogue sync. `JwtGuard` is
 * registered globally, so this route requires a valid `access_token` cookie
 * and nothing more.
 */
@Controller({
  path: 'market/bitcoin',
  version: '1'
})
@ApiTags(ApiTagName.MARKET)
export class BitcoinMarketController {
  constructor(
    @Inject(GET_BITCOIN_MARKET_USE_CASE)
    private readonly getBitcoinMarketUseCase: IGetBitcoinMarketUseCase
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetBitcoinMarket()
  async getBitcoin() {
    const bitcoin = await this.getBitcoinMarketUseCase.execute();

    return plainToInstance(BitcoinMarketResponseDto, bitcoin, {
      excludeExtraneousValues: true
    });
  }
}
