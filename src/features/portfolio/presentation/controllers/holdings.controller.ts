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
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '@presentation/dto/id.dto';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { HoldingMapper } from '../../application/mappers/holding.mapper';
import {
  CREATE_HOLDING_USE_CASE,
  DELETE_HOLDING_USE_CASE,
  ICreateHoldingUseCase,
  IDeleteHoldingUseCase,
  IListHoldingsUseCase,
  IUpdateHoldingUseCase,
  LIST_HOLDINGS_USE_CASE,
  UPDATE_HOLDING_USE_CASE
} from '../../application/interfaces/portfolio.interface';
import { CreateHoldingRequestDto } from '../dto/request/create-holding.request.dto';
import { HoldingsListRequestDto } from '../dto/request/holdings-list.request.dto';
import { UpdateHoldingRequestDto } from '../dto/request/update-holding.request.dto';
import {
  ApiCreateHolding,
  ApiDeleteHolding,
  ApiListHoldings,
  ApiUpdateHolding
} from '../swagger/portfolio.swagger';

@Controller({
  path: 'holdings',
  version: '1'
})
@ApiTags(ApiTagName.PORTFOLIOS)
export class HoldingsController {
  constructor(
    @Inject(CREATE_HOLDING_USE_CASE)
    private readonly createHoldingUseCase: ICreateHoldingUseCase,
    @Inject(UPDATE_HOLDING_USE_CASE)
    private readonly updateHoldingUseCase: IUpdateHoldingUseCase,
    @Inject(DELETE_HOLDING_USE_CASE)
    private readonly deleteHoldingUseCase: IDeleteHoldingUseCase,
    @Inject(LIST_HOLDINGS_USE_CASE)
    private readonly listHoldingsUseCase: IListHoldingsUseCase,
    private readonly holdingMapper: HoldingMapper
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateHolding()
  async createHolding(
    @User() user: UserEntity,
    @Body() dto: CreateHoldingRequestDto
  ) {
    const holding = await this.createHoldingUseCase.execute(user.id, dto);

    return this.holdingMapper.toResponse(holding);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListHoldings()
  async listHoldings(
    @User() user: UserEntity,
    @Query() query: HoldingsListRequestDto
  ) {
    const holdings = await this.listHoldingsUseCase.execute(user.id, {
      portfolioId: query.portfolioId
    });

    return {
      items: this.holdingMapper.toResponseList(holdings),
      nextCursor: null
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateHolding()
  async updateHolding(
    @Param() params: IdDto,
    @User() user: UserEntity,
    @Body() dto: UpdateHoldingRequestDto
  ) {
    const holding = await this.updateHoldingUseCase.execute(
      params.id,
      user.id,
      dto
    );

    return this.holdingMapper.toResponse(holding);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteHolding()
  deleteHolding(@Param() params: IdDto, @User() user: UserEntity) {
    return this.deleteHoldingUseCase.execute(params.id, user.id);
  }
}
