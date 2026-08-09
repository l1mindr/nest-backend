import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PortfolioPnlResult } from '../interfaces/portfolio.interface';
import { PortfolioPnlResponseDto } from '../../presentation/dto/response/portfolio-pnl.response.dto';

/**
 * Maps a portfolio P&L application result to its response DTO.
 *
 * No financial arithmetic happens here; all values are already computed by
 * the use case with exact decimal arithmetic and are passed through unchanged.
 */
@Injectable()
export class PortfolioPnlMapper {
  toResponse(result: PortfolioPnlResult): PortfolioPnlResponseDto {
    return plainToInstance(
      PortfolioPnlResponseDto,
      { ...result, costBasis: result.costBasisStrategy },
      { excludeExtraneousValues: true }
    );
  }
}
