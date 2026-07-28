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
import { IdDto } from '@infrastructure/http/dto/id.dto';
import { PriceAlertMapper } from '../../application/mappers/price-alert.mapper';
import { CreatePriceAlertRequestDto } from '../dto/request/create-price-alert.request.dto';
import { UpdatePriceAlertRequestDto } from '../dto/request/update-price-alert.request.dto';
import { ListPriceAlertsRequestDto } from '../dto/request/list-price-alerts.request.dto';
import {
  ICreatePriceAlertUseCase,
  IUpdatePriceAlertUseCase,
  ICancelPriceAlertUseCase,
  IListPriceAlertsUseCase,
  CREATE_PRICE_ALERT_USE_CASE,
  UPDATE_PRICE_ALERT_USE_CASE,
  CANCEL_PRICE_ALERT_USE_CASE,
  LIST_PRICE_ALERTS_USE_CASE
} from '../../application/interfaces/coin-tracker.interface';
import {
  ApiCreatePriceAlert,
  ApiListPriceAlerts,
  ApiUpdatePriceAlert,
  ApiCancelPriceAlert
} from '../swagger/coin-tracker.swagger';

@Controller({
  path: 'price-alerts',
  version: '1'
})
@ApiTags('price-alerts')
export class PriceAlertsController {
  constructor(
    @Inject(CREATE_PRICE_ALERT_USE_CASE)
    private readonly createPriceAlertUseCase: ICreatePriceAlertUseCase,
    @Inject(UPDATE_PRICE_ALERT_USE_CASE)
    private readonly updatePriceAlertUseCase: IUpdatePriceAlertUseCase,
    @Inject(CANCEL_PRICE_ALERT_USE_CASE)
    private readonly cancelPriceAlertUseCase: ICancelPriceAlertUseCase,
    @Inject(LIST_PRICE_ALERTS_USE_CASE)
    private readonly listPriceAlertsUseCase: IListPriceAlertsUseCase,
    private readonly priceAlertMapper: PriceAlertMapper
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatePriceAlert()
  async createPriceAlert(
    @User() user: UserEntity,
    @Body() dto: CreatePriceAlertRequestDto
  ) {
    const alert = await this.createPriceAlertUseCase.execute(user.id, dto);

    return this.priceAlertMapper.toResponse(alert);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListPriceAlerts()
  async listPriceAlerts(
    @User() user: UserEntity,
    @Query() query: ListPriceAlertsRequestDto
  ) {
    const { items, nextCursor } = await this.listPriceAlertsUseCase.execute(
      user.id,
      {
        cursor: query.cursor,
        limit: query.limit,
        status: query.status,
        direction: query.direction,
        coinId: query.coinId
      }
    );

    return {
      items: this.priceAlertMapper.toResponseList(items),
      nextCursor
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdatePriceAlert()
  async updatePriceAlert(
    @Param() params: IdDto,
    @User() user: UserEntity,
    @Body() dto: UpdatePriceAlertRequestDto
  ) {
    const alert = await this.updatePriceAlertUseCase.execute(
      params.id,
      user.id,
      dto
    );

    return this.priceAlertMapper.toResponse(alert);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCancelPriceAlert()
  cancelPriceAlert(@Param() params: IdDto, @User() user: UserEntity) {
    return this.cancelPriceAlertUseCase.execute(params.id, user.id);
  }
}
