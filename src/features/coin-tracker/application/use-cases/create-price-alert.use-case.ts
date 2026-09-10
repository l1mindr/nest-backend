import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CoinTrackerErrors } from '../../domain/errors/coin-tracker-errors';
import { PriceAlert } from '../../domain/entities/price-alert.entity';
import {
  ICoinRepository,
  ICreatePriceAlertUseCase,
  IPriceAlertRepository,
  COIN_REPOSITORY,
  PRICE_ALERT_REPOSITORY
} from '../interfaces/coin-tracker.interface';
import { CreatePriceAlertRequestDto } from '../../presentation/dto/request/create-price-alert.request.dto';

@Injectable()
export class CreatePriceAlertUseCase implements ICreatePriceAlertUseCase {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository,
    @Inject(COIN_REPOSITORY)
    private readonly coinRepository: ICoinRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
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

    // The symbol and the direction are what a history row needs to read as
    // "you set an alert on BTC for a rise". The target price is left out: it
    // is a financial detail the alert itself already holds, and the activity
    // screen is not where it needs to be duplicated.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.PRICE_ALERT,
      action: ActivityAction.CREATED,
      entityType: 'PRICE_ALERT',
      entityId: alert.id,
      metadata: {
        assetSymbol: coin.symbol,
        direction: alert.direction
      }
    });

    return alert;
  }
}
