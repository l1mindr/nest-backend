import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { PortfolioPnlMapper } from '../../application/mappers/portfolio-pnl.mapper';
import {
  GET_PORTFOLIO_PNL_USE_CASE,
  IGetPortfolioPnlUseCase
} from '../../application/interfaces/portfolio.interface';
import { PortfolioPnlParamsDto } from '../dto/request/portfolio-pnl.params.dto';
import { PortfolioPnlRequestDto } from '../dto/request/portfolio-pnl.request.dto';
import { ApiGetPortfolioPnl } from '../swagger/portfolio.swagger';

@Controller({
  path: 'portfolios/:portfolioId/pnl',
  version: '1'
})
@ApiTags(ApiTagName.PORTFOLIOS)
export class PortfolioPnlController {
  constructor(
    @Inject(GET_PORTFOLIO_PNL_USE_CASE)
    private readonly getPortfolioPnlUseCase: IGetPortfolioPnlUseCase,
    private readonly pnlMapper: PortfolioPnlMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiGetPortfolioPnl()
  async getPortfolioPnl(
    @User() user: UserEntity,
    @Param() params: PortfolioPnlParamsDto,
    @Query() query: PortfolioPnlRequestDto
  ) {
    const result = await this.getPortfolioPnlUseCase.execute(
      user.id,
      params.portfolioId,
      query.costBasis
    );

    return this.pnlMapper.toResponse(result);
  }
}
