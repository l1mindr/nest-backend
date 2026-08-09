import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Holding } from '../../domain/entities/holding.entity';
import { HoldingResponseDto } from '../../presentation/dto/response/holding.response.dto';

@Injectable()
export class HoldingMapper {
  toResponse(holding: Holding): HoldingResponseDto {
    return plainToInstance(HoldingResponseDto, holding, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(holdings: Holding[]): HoldingResponseDto[] {
    return holdings.map((holding) => this.toResponse(holding));
  }
}
