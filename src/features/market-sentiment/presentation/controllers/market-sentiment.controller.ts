import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  GET_FEAR_GREED_USE_CASE,
  IGetFearGreedUseCase
} from '../../application/interfaces/market-sentiment.interface';
import { FearGreedResponseDto } from '../dto/response/fear-greed.response.dto';
import { ApiGetFearGreed } from '../swagger/market-sentiment.swagger';

/**
 * Crypto Fear & Greed Index, synchronised from alternative.me. `JwtGuard` is
 * registered globally, so this route requires a valid `access_token` cookie
 * and nothing more.
 */
@Controller({
  path: 'market/fear-greed',
  version: '1'
})
@ApiTags(ApiTagName.MARKET)
export class MarketSentimentController {
  constructor(
    @Inject(GET_FEAR_GREED_USE_CASE)
    private readonly getFearGreedUseCase: IGetFearGreedUseCase
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetFearGreed()
  async getFearGreed() {
    const fearGreed = await this.getFearGreedUseCase.execute();

    return plainToInstance(FearGreedResponseDto, fearGreed, {
      excludeExtraneousValues: true
    });
  }
}
