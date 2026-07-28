import { ClockService } from '@core/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CoinTrackerErrors } from '../../errors/coin-tracker-errors';
import { PriceAlert } from '../../entities/price-alert.entity';
import {
  ICoinRepository,
  ICreatePriceAlertUseCase,
  IPriceAlertRepository,
  COIN_REPOSITORY,
  PRICE_ALERT_REPOSITORY
} from '../../interfaces/coin-tracker.interface';
import { CreatePriceAlertRequestDto } from '../../dto/request/create-price-alert.request.dto';

@Injectable()
export class CreatePriceAlertUseCase implements ICreatePriceAlertUseCase {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository,
    @Inject(COIN_REPOSITORY)
    private readonly coinRepository: ICoinRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CreatePriceAlertUseCase.name);
  }

  async execute(
    userId: string,
    dto: CreatePriceAlertRequestDto
  ): Promise<PriceAlert> {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt.getTime() <= this.clockService.nowMs()) {
      throw CoinTrackerErrors.invalidExpiration();
    }

    const coin = await this.coinRepository.findActiveById(dto.coinId);

    if (!coin) {
      throw CoinTrackerErrors.coinNotFound(dto.coinId);
    }

    const alert = await this.priceAlertRepository.create({
      userId,
      coinId: dto.coinId,
      direction: dto.direction,
      targetPrice: String(dto.targetPrice),
      triggerMode: dto.triggerMode,
      expiresAt,
      notificationChannels: dto.notificationChannels
    });

    alert.coin = coin;

    this.logger.info(
      {
        event: LogEvent.PRICE_ALERT_CREATED,
        alertId: alert.id,
        userId,
        coinId: alert.coinId,
        direction: alert.direction,
        targetPrice: alert.targetPrice
      },
      'Price alert created'
    );

    return alert;
  }
}
