import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CoinTrackerErrors } from '../../domain/errors/coin-tracker-errors';
import { AlertStatus } from '../../domain/enums/alert-status.enum';
import {
  IPriceAlertRepository,
  ICancelPriceAlertUseCase,
  PRICE_ALERT_REPOSITORY
} from '../interfaces/coin-tracker.interface';

@Injectable()
export class CancelPriceAlertUseCase implements ICancelPriceAlertUseCase {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CancelPriceAlertUseCase.name);
  }

  async execute(alertId: string, userId: string): Promise<void> {
    const alert = await this.priceAlertRepository.findByIdAndUser(
      alertId,
      userId
    );

    if (!alert) {
      throw CoinTrackerErrors.priceAlertNotFound(alertId);
    }

    if (alert.status === AlertStatus.CANCELLED) {
      throw CoinTrackerErrors.priceAlertCancelled(alertId);
    }

    if (alert.status === AlertStatus.EXPIRED) {
      throw CoinTrackerErrors.priceAlertExpired(alertId);
    }

    await this.priceAlertRepository.updateOwned(alertId, userId, {
      status: AlertStatus.CANCELLED
    });

    this.logger.info(
      {
        event: LogEvent.PRICE_ALERT_CANCELLED,
        alertId,
        userId,
        coinId: alert.coinId
      },
      'Price alert cancelled'
    );
  }
}
