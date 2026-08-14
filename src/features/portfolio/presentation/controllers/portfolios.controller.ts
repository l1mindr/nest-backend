import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { IdDto } from '@presentation/dto/id.dto';
import { PortfolioMapper } from '../../application/mappers/portfolio.mapper';
import { PortfolioValuationMapper } from '../../application/mappers/portfolio-valuation.mapper';
import {
  CREATE_PORTFOLIO_USE_CASE,
  DELETE_PORTFOLIO_USE_CASE,
  GET_PORTFOLIO_USE_CASE,
  GET_PORTFOLIO_VALUATION_USE_CASE,
  ICreatePortfolioUseCase,
  IDeletePortfolioUseCase,
  IGetPortfolioUseCase,
  IGetPortfolioValuationUseCase,
  IListPortfoliosUseCase,
  IUpdatePortfolioUseCase,
  LIST_PORTFOLIOS_USE_CASE,
  UPDATE_PORTFOLIO_USE_CASE
} from '../../application/interfaces/portfolio.interface';
import { CreatePortfolioRequestDto } from '../dto/request/create-portfolio.request.dto';
import { UpdatePortfolioRequestDto } from '../dto/request/update-portfolio.request.dto';
import {
  ApiCreatePortfolio,
  ApiDeletePortfolio,
  ApiGetPortfolio,
  ApiGetPortfolioValuation,
  ApiListPortfolios,
  ApiUpdatePortfolio
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
    @Inject(UPDATE_PORTFOLIO_USE_CASE)
    private readonly updatePortfolioUseCase: IUpdatePortfolioUseCase,
    @Inject(DELETE_PORTFOLIO_USE_CASE)
    private readonly deletePortfolioUseCase: IDeletePortfolioUseCase,
    @Inject(GET_PORTFOLIO_VALUATION_USE_CASE)
    private readonly getPortfolioValuationUseCase: IGetPortfolioValuationUseCase,
    private readonly portfolioMapper: PortfolioMapper,
    private readonly portfolioValuationMapper: PortfolioValuationMapper
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

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdatePortfolio()
  async updatePortfolio(
    @User() user: UserEntity,
    @Param() params: IdDto,
    @Body() dto: UpdatePortfolioRequestDto
  ) {
    const portfolio = await this.updatePortfolioUseCase.execute(
      params.id,
      user.id,
      dto
    );

    return this.portfolioMapper.toResponse(portfolio);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeletePortfolio()
  async deletePortfolio(@User() user: UserEntity, @Param() params: IdDto) {
    await this.deletePortfolioUseCase.execute(params.id, user.id);
  }

  @Get(':id/valuation')
  @HttpCode(HttpStatus.OK)
  @ApiGetPortfolioValuation()
  async getPortfolioValuation(
    @User() user: UserEntity,
    @Param() params: IdDto
  ) {
    const valuation = await this.getPortfolioValuationUseCase.execute(
      user.id,
      params.id
    );

    return this.portfolioValuationMapper.toResponse(valuation);
  }
}
