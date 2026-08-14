import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Portfolio } from '../../domain/entities/portfolio.entity';
import { CreatePortfolioRequestDto } from '../../presentation/dto/request/create-portfolio.request.dto';
import {
  CreatePortfolioData,
  ICreatePortfolioUseCase,
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY
} from '../interfaces/portfolio.interface';

@Injectable()
export class CreatePortfolioUseCase implements ICreatePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CreatePortfolioUseCase.name);
  }

  async execute(
    userId: string,
    dto: CreatePortfolioRequestDto
  ): Promise<Portfolio> {
    const data: CreatePortfolioData = {
      userId,
      name: dto.name,
      sourceType: dto.sourceType,
      walletAddress: dto.walletAddress ?? null
    };

    const portfolio = await this.portfolioRepository.create(data);

    this.logger.info(
      {
        event: LogEvent.PORTFOLIO_CREATED,
        portfolioId: portfolio.id,
        userId,
        sourceType: portfolio.sourceType
      },
      'Portfolio source created'
    );

    return portfolio;
  }
}
