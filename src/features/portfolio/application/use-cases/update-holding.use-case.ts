import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Holding } from '../../domain/entities/holding.entity';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { UpdateHoldingRequestDto } from '../../presentation/dto/request/update-holding.request.dto';
import {
  HOLDING_REPOSITORY,
  IHoldingRepository,
  IUpdateHoldingUseCase,
  UpdateHoldingData
} from '../interfaces/portfolio.interface';

@Injectable()
export class UpdateHoldingUseCase implements IUpdateHoldingUseCase {
  constructor(
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UpdateHoldingUseCase.name);
  }

  async execute(
    holdingId: string,
    userId: string,
    dto: UpdateHoldingRequestDto
  ): Promise<Holding> {
    if (dto.amount === undefined && dto.notes === undefined) {
      throw PortfolioErrors.holdingEmptyUpdate();
    }

    const existing = await this.holdingRepository.findByIdAndUser(
      holdingId,
      userId
    );

    if (!existing) {
      throw PortfolioErrors.holdingNotFound(holdingId);
    }

    const data: UpdateHoldingData = {};

    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.holdingRepository.update(
      holdingId,
      userId,
      data
    );

    if (!updated) {
      throw PortfolioErrors.holdingNotFound(holdingId);
    }

    this.logger.info(
      {
        event: LogEvent.HOLDING_UPDATED,
        holdingId,
        userId,
        portfolioId: updated.portfolioId,
        assetId: updated.assetId,
        amount: updated.amount
      },
      'Portfolio holding updated'
    );

    return updated;
  }
}
