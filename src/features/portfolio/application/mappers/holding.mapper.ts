import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Holding } from '../../domain/entities/holding.entity';
import { HoldingResponseDto } from '../../presentation/dto/response/holding.response.dto';
import { DerivedHolding } from '../interfaces/portfolio.interface';

@Injectable()
export class HoldingMapper {
  /**
   * Accepts a stored `holding` row or a ledger-derived position: both carry
   * the fields the response exposes, so they map identically.
   */
  toResponse(holding: Holding | DerivedHolding): HoldingResponseDto {
    return plainToInstance(HoldingResponseDto, holding, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(holdings: (Holding | DerivedHolding)[]): HoldingResponseDto[] {
    return holdings.map((holding) => this.toResponse(holding));
  }
}
