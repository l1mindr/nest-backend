import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { IdDto } from '@presentation/dto/id.dto';
import { PortfolioMapper } from '../../application/mappers/portfolio.mapper';
import {
  CREATE_PORTFOLIO_USE_CASE,
  GET_PORTFOLIO_USE_CASE,
  ICreatePortfolioUseCase,
  IGetPortfolioUseCase,
  IListPortfoliosUseCase,
  LIST_PORTFOLIOS_USE_CASE
} from '../../application/interfaces/portfolio.interface';
import { CreatePortfolioRequestDto } from '../dto/request/create-portfolio.request.dto';
import {
  ApiCreatePortfolio,
  ApiGetPortfolio,
  ApiListPortfolios
} from '../swagger/portfolio.swagger';

@Controller({
  path: 'portfolios',
  version: '1'
})
@ApiTags(ApiTagName.PORTFOLIOS)
export class PortfoliosController {
  constructor(
    @Inject(CREATE_PORTFOLIO_USE_CASE)
    private readonly createPortfolioUseCase: ICreatePortfolioUseCase,
    @Inject(LIST_PORTFOLIOS_USE_CASE)
    private readonly listPortfoliosUseCase: IListPortfoliosUseCase,
    @Inject(GET_PORTFOLIO_USE_CASE)
    private readonly getPortfolioUseCase: IGetPortfolioUseCase,
    private readonly portfolioMapper: PortfolioMapper
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatePortfolio()
  async createPortfolio(
    @User() user: UserEntity,
    @Body() dto: CreatePortfolioRequestDto
  ) {
    const portfolio = await this.createPortfolioUseCase.execute(user.id, dto);

    return this.portfolioMapper.toResponse(portfolio);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListPortfolios()
  async listPortfolios(@User() user: UserEntity) {
    const portfolios = await this.listPortfoliosUseCase.execute(user.id);

    return this.portfolioMapper.toResponseList(portfolios);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiGetPortfolio()
  async getPortfolio(@User() user: UserEntity, @Param() params: IdDto) {
    const portfolio = await this.getPortfolioUseCase.execute(
      user.id,
      params.id
    );

    return this.portfolioMapper.toResponse(portfolio);
  }
}
