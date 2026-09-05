import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  GET_USDT_TOMAN_USE_CASE,
  IGetUsdtTomanUseCase
} from '../../application/interfaces/usdt-toman.interface';
import { UsdtTomanResponseDto } from '../dto/response/usdt-toman.response.dto';
import { ApiGetUsdtToman } from '../swagger/usdt-toman.swagger';

/**
 * Live USDT/Toman rate. Separate upstream from the CoinGecko routes on this
 * tag, because CoinGecko does not quote Iranian currency. `JwtGuard` is registered
 * globally, so this route requires a valid `access_token` cookie.
 */
@Controller({
  path: 'market/usdt-toman',
  version: '1'
})
@ApiTags(ApiTagName.MARKET)
export class UsdtTomanController {
  constructor(
    @Inject(GET_USDT_TOMAN_USE_CASE)
    private readonly getUsdtTomanUseCase: IGetUsdtTomanUseCase
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetUsdtToman()
  async getUsdtToman() {
    const rate = await this.getUsdtTomanUseCase.execute();

    return plainToInstance(UsdtTomanResponseDto, rate, {
      excludeExtraneousValues: true
    });
  }
}
