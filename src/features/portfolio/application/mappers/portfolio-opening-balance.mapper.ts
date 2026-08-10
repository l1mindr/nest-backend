import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PortfolioOpeningBalance } from '../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioOpeningBalanceResponseDto } from '../../presentation/dto/response/portfolio-opening-balance.response.dto';

@Injectable()
export class PortfolioOpeningBalanceMapper {
  toResponse(
    openingBalance: PortfolioOpeningBalance
  ): PortfolioOpeningBalanceResponseDto {
    return plainToInstance(PortfolioOpeningBalanceResponseDto, openingBalance, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(
    openingBalances: PortfolioOpeningBalance[]
  ): PortfolioOpeningBalanceResponseDto[] {
    return openingBalances.map((openingBalance) =>
      this.toResponse(openingBalance)
    );
  }
}
