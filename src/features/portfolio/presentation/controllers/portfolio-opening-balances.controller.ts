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
  Put
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { PortfolioOpeningBalanceMapper } from '../../application/mappers/portfolio-opening-balance.mapper';
import {
  IListPortfolioOpeningBalancesUseCase,
  ISetPortfolioOpeningBalanceUseCase,
  LIST_PORTFOLIO_OPENING_BALANCES_USE_CASE,
  SET_PORTFOLIO_OPENING_BALANCE_USE_CASE
} from '../../application/interfaces/portfolio.interface';
import {
  PortfolioOpeningBalanceParamsDto,
  PortfolioOpeningBalancesParamsDto
} from '../dto/request/portfolio-opening-balance.params.dto';
import { SetPortfolioOpeningBalanceRequestDto } from '../dto/request/set-portfolio-opening-balance.request.dto';
import {
  ApiListPortfolioOpeningBalances,
  ApiSetPortfolioOpeningBalance
} from '../swagger/portfolio.swagger';

@Controller({
  path: 'portfolios/:portfolioId/opening-balances',
  version: '1'
})
@ApiTags(ApiTagName.PORTFOLIOS)
export class PortfolioOpeningBalancesController {
  constructor(
    @Inject(SET_PORTFOLIO_OPENING_BALANCE_USE_CASE)
    private readonly setOpeningBalanceUseCase: ISetPortfolioOpeningBalanceUseCase,
    @Inject(LIST_PORTFOLIO_OPENING_BALANCES_USE_CASE)
    private readonly listOpeningBalancesUseCase: IListPortfolioOpeningBalancesUseCase,
    private readonly openingBalanceMapper: PortfolioOpeningBalanceMapper
  ) {}

  @Put(':assetId')
  @HttpCode(HttpStatus.OK)
  @ApiSetPortfolioOpeningBalance()
  async setOpeningBalance(
    @User() user: UserEntity,
    @Param() params: PortfolioOpeningBalanceParamsDto,
    @Body() dto: SetPortfolioOpeningBalanceRequestDto
  ) {
    const openingBalance = await this.setOpeningBalanceUseCase.execute(
      user.id,
      params.portfolioId,
      params.assetId,
      dto
    );

    return this.openingBalanceMapper.toResponse(openingBalance);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListPortfolioOpeningBalances()
  async listOpeningBalances(
    @User() user: UserEntity,
    @Param() params: PortfolioOpeningBalancesParamsDto
  ) {
    const openingBalances = await this.listOpeningBalancesUseCase.execute(
      user.id,
      params.portfolioId
    );

    return {
      items: this.openingBalanceMapper.toResponseList(openingBalances)
    };
  }
}
