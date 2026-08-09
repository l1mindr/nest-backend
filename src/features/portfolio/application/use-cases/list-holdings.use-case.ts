import { Inject, Injectable } from '@nestjs/common';
import { Holding } from '../../domain/entities/holding.entity';
import {
  HOLDING_REPOSITORY,
  IHoldingRepository,
  IListHoldingsUseCase
} from '../interfaces/portfolio.interface';

@Injectable()
export class ListHoldingsUseCase implements IListHoldingsUseCase {
  constructor(
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository
  ) {}

  async execute(
    userId: string,
    options: { portfolioId?: string }
  ): Promise<Holding[]> {
    return this.holdingRepository.listByUser(userId, options);
  }
}
