import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PortfolioValuation } from '../interfaces/portfolio.interface';
import { PortfolioValuationResponseDto } from '../../presentation/dto/response/portfolio-valuation.response.dto';

@Injectable()
export class PortfolioValuationMapper {
  toResponse(valuation: PortfolioValuation): PortfolioValuationResponseDto {
    return plainToInstance(PortfolioValuationResponseDto, valuation, {
      excludeExtraneousValues: true
    });
  }
}
