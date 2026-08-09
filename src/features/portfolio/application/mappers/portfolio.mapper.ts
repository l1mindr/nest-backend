import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { PortfolioResponseDto } from '../../presentation/dto/response/portfolio.response.dto';

@Injectable()
export class PortfolioMapper {
  toResponse(portfolio: Portfolio): PortfolioResponseDto {
    return plainToInstance(PortfolioResponseDto, portfolio, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(portfolios: Portfolio[]): PortfolioResponseDto[] {
    return portfolios.map((portfolio) => this.toResponse(portfolio));
  }
}
