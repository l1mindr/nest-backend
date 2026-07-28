import { ClockService } from '@core/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CoinTrackerErrors } from '../../errors/coin-tracker-errors';
import { PriceAlert } from '../../entities/price-alert.entity';
import { AlertStatus } from '../../enums/alert-status.enum';
import {
  IPriceAlertRepository,
  IUpdatePriceAlertUseCase,
  PRICE_ALERT_REPOSITORY,
  UpdatePriceAlertData
} from '../../interfaces/coin-tracker.interface';
import { UpdatePriceAlertRequestDto } from '../../dto/request/update-price-alert.request.dto';

@Injectable()
export class UpdatePriceAlertUseCase implements IUpdatePriceAlertUseCase {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UpdatePriceAlertUseCase.name);
  }

  async execute(
    alertId: string,
    userId: string,
    dto: UpdatePriceAlertRequestDto
  ): Promise<PriceAlert> {
    if (Object.keys(dto).length === 0) {
      throw CoinTrackerErrors.emptyUpdate();
    }

    const alert = await this.priceAlertRepository.findByIdAndUser(
      alertId,
      userId
    );

    if (!alert) {
      throw CoinTrackerErrors.priceAlertNotFound(alertId);
    }

    const now = this.clockService.nowDate();

    if (
      alert.status === AlertStatus.ACTIVE &&
      alert.expiresAt &&
      alert.expiresAt.getTime() < now.getTime()
    ) {
      await this.priceAlertRepository.updateOwned(alertId, userId, {
        status: AlertStatus.EXPIRED
      });
      throw CoinTrackerErrors.priceAlertExpired(alertId);
    }

    if (alert.status === AlertStatus.EXPIRED) {
      throw CoinTrackerErrors.priceAlertExpired(alertId);
    }

    if (alert.status === AlertStatus.CANCELLED) {
      throw CoinTrackerErrors.priceAlertCancelled(alertId);
    }

    if (alert.status === AlertStatus.TRIGGERED) {
      throw CoinTrackerErrors.priceAlertTriggered(alertId);
    }

    const data = this.toUpdateData(dto, now);

    await this.priceAlertRepository.updateOwned(alertId, userId, data);

    const updated = await this.priceAlertRepository.findByIdAndUser(
      alertId,
      userId
    );

    if (!updated) {
      throw CoinTrackerErrors.priceAlertNotFound(alertId);
    }

    this.logger.info(
      {
        event: LogEvent.PRICE_ALERT_UPDATED,
        alertId,
        userId,
        coinId: updated.coinId
      },
      'Price alert updated'
    );

    return updated;
  }

  private toUpdateData(
    dto: UpdatePriceAlertRequestDto,
    now: Date
  ): UpdatePriceAlertData {
    const data: UpdatePriceAlertData = {};

    if (dto.targetPrice !== undefined) {
      data.targetPrice = String(dto.targetPrice);
      data.lastCheckedPrice = null;
    }

    if (dto.direction !== undefined) {
      data.direction = dto.direction;
      data.lastCheckedPrice = null;
    }

    if (dto.triggerMode !== undefined) {
      data.triggerMode = dto.triggerMode;
    }

    if (dto.expiresAt !== undefined) {
      const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

      if (expiresAt && expiresAt.getTime() <= now.getTime()) {
        throw CoinTrackerErrors.invalidExpiration();
      }

      data.expiresAt = expiresAt;
    }

    if (dto.notificationChannels !== undefined) {
      data.notificationChannels = dto.notificationChannels;
    }

    return data;
  }
}
