import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionResponseDto } from '../../presentation/dto/response/portfolio-transaction.response.dto';

@Injectable()
export class PortfolioTransactionMapper {
  toResponse(
    transaction: PortfolioTransaction
  ): PortfolioTransactionResponseDto {
    return plainToInstance(PortfolioTransactionResponseDto, transaction, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(
    transactions: PortfolioTransaction[]
  ): PortfolioTransactionResponseDto[] {
    return transactions.map((transaction) => this.toResponse(transaction));
  }
}
