import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Coin } from '../../entities/coin.entity';
import { CoinResponseDto } from '../../dto/response/coin.response.dto';

@Injectable()
export class CoinMapper {
  toResponse(coin: Coin): CoinResponseDto {
    return plainToInstance(CoinResponseDto, coin, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(coins: Coin[]): CoinResponseDto[] {
    return coins.map((c) => this.toResponse(c));
  }
}
