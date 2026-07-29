import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { PinoLogger } from 'nestjs-pino';
import { AlertStatus } from '../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../domain/enums/alert-trigger-mode.enum';
import {
  COINGECKO_CLIENT,
  ICoinGeckoClient,
  INotificationService,
  IPriceAlertRepository,
  IPriceCheckService,
  NOTIFICATION_SERVICE,
  PRICE_ALERT_REPOSITORY
} from '../interfaces/coin-tracker.interface';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { PriceAlert } from '../../domain/entities/price-alert.entity';
import { PriceAlertEvaluatorService } from './price-alert-evaluator.service';

const PRICE_REQUEST_BATCH_SIZE = 50;
const ALERT_PROCESSING_PAGE_SIZE = 500;

interface PriceCheckCounters {
  checked: number;
  expired: number;
  triggered: number;
  skipped: number;
}

@Injectable()
export class PriceCheckService implements IPriceCheckService {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository,
    @Inject(COINGECKO_CLIENT)
    private readonly coingeckoClient: ICoinGeckoClient,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly clockService: ClockService,
    private readonly evaluator: PriceAlertEvaluatorService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(PriceCheckService.name);
  }

  async check(): Promise<void> {
    const now = this.clockService.nowDate();

    this.logger.info(
      { event: LogEvent.PRICE_CHECK_STARTED, checkedAt: now },
      'Price alert check started'
    );

    try {
      await this.executeCheck(now);
    } catch (error) {
      this.logger.error(
        { event: LogEvent.PRICE_CHECK_FAILED, err: error },
        'Price alert check failed'
      );
      throw error;
    }
  }

  private async executeCheck(now: Date): Promise<void> {
    const expiredAlerts =
      await this.priceAlertRepository.expireActiveAlerts(now);

    if (expiredAlerts.length > 0) {
      this.logger.info(
        {
          event: LogEvent.PRICE_ALERT_EXPIRED,
          alertIds: expiredAlerts.map(({ id }) => id),
          count: expiredAlerts.length
        },
        'Expired price alerts'
      );
    }

    const coinIds =
      await this.priceAlertRepository.findActiveCoinIdsForScheduler();
    const prices = await this.fetchPricesInBatches(coinIds);
    const counters: PriceCheckCounters = {
      checked: 0,
      expired: expiredAlerts.length,
      triggered: 0,
      skipped: 0
    };
    let cursorId: string | null = null;

    while (true) {
      const alerts =
        await this.priceAlertRepository.findActiveAlertsForScheduler({
          cursorId,
          limit: ALERT_PROCESSING_PAGE_SIZE
        });

      if (alerts.length === 0) break;

      for (const alert of alerts) {
        try {
          await this.processAlert(alert, prices, now, counters);
        } catch (error) {
          counters.skipped += 1;
          this.logger.error(
            {
              event: LogEvent.PRICE_ALERT_SKIPPED,
              alertId: alert.id,
              userId: alert.userId,
              coinId: alert.coinId,
              reason: 'processing_failed',
              err: error
            },
            'Price alert processing failed'
          );
        }
      }

      cursorId = alerts[alerts.length - 1].id;

      if (alerts.length < ALERT_PROCESSING_PAGE_SIZE) break;
    }

    this.logger.info(
      {
        event: LogEvent.PRICE_CHECK_COMPLETED,
        ...counters,
        coinCount: coinIds.length
      },
      'Price alert check completed'
    );
  }

  private async processAlert(
    alert: PriceAlert,
    prices: Record<string, { usd: number }>,
    now: Date,
    counters: PriceCheckCounters
  ): Promise<void> {
    if (alert.expiresAt && alert.expiresAt.getTime() < now.getTime()) {
      await this.priceAlertRepository.updateOwned(alert.id, alert.userId, {
        status: AlertStatus.EXPIRED
      });
      counters.expired += 1;

      this.logger.info(
        {
          event: LogEvent.PRICE_ALERT_EXPIRED,
          alertId: alert.id,
          userId: alert.userId,
          coinId: alert.coinId
        },
        'Price alert expired before evaluation'
      );
      return;
    }

    if (!alert.coin?.isActive) {
      this.logSkipped(alert, 'coin_inactive');
      counters.skipped += 1;
      return;
    }

    const currentPrice = prices[alert.coinId]?.usd;

    if (
      typeof currentPrice !== 'number' ||
      !Number.isFinite(currentPrice) ||
      currentPrice < 0
    ) {
      this.logSkipped(alert, 'price_unavailable');
      counters.skipped += 1;
      return;
    }

    const currentPriceText = String(currentPrice);
    counters.checked += 1;

    const crossed = this.evaluator.hasCrossed(
      alert.direction,
      alert.lastCheckedPrice,
      currentPriceText,
      alert.targetPrice
    );

    if (!crossed) {
      await this.priceAlertRepository.updateLastCheckedPrice(
        alert.id,
        currentPriceText
      );
      return;
    }

    if (
      !this.evaluator.isCooldownExpired(
        alert.lastTriggeredAt,
        alert.notificationCooldownMinutes,
        now
      )
    ) {
      await this.priceAlertRepository.updateLastCheckedPrice(
        alert.id,
        currentPriceText
      );
      counters.skipped += 1;
      this.logSkipped(alert, 'cooldown_active');
      return;
    }

    await this.sendNotifications(alert, currentPriceText);

    const status =
      alert.triggerMode === AlertTriggerMode.ONCE
        ? AlertStatus.TRIGGERED
        : AlertStatus.ACTIVE;
    const updated = await this.priceAlertRepository.markTriggered(alert.id, {
      lastCheckedPrice: currentPriceText,
      lastTriggeredAt: now,
      status
    });

    if (!updated) {
      counters.skipped += 1;
      this.logSkipped(alert, 'state_changed');
      return;
    }

    counters.triggered += 1;
    this.logger.info(
      {
        event: LogEvent.PRICE_ALERT_TRIGGERED,
        alertId: alert.id,
        userId: alert.userId,
        coinId: alert.coinId,
        direction: alert.direction,
        targetPrice: alert.targetPrice,
        currentPrice: currentPriceText,
        triggerMode: alert.triggerMode
      },
      'Price alert triggered'
    );
  }

  private async sendNotifications(
    alert: PriceAlert,
    currentPrice: string
  ): Promise<void> {
    const params = {
      userId: alert.userId,
      coinId: alert.coinId,
      coinName: alert.coin.name,
      direction: alert.direction,
      targetPrice: alert.targetPrice,
      currentPrice
    };

    await Promise.all(
      alert.notificationChannels.map((channel) => {
        if (channel === NotificationChannel.EMAIL) {
          return this.notificationService.sendEmail(params);
        }

        return this.notificationService.sendSms(params);
      })
    );
  }

  private async fetchPricesInBatches(
    coinIds: string[]
  ): Promise<Record<string, { usd: number }>> {
    const allPrices: Record<string, { usd: number }> = {};

    for (let i = 0; i < coinIds.length; i += PRICE_REQUEST_BATCH_SIZE) {
      const batch = coinIds.slice(i, i + PRICE_REQUEST_BATCH_SIZE);
      const batchPrices = await this.coingeckoClient.getPrices(batch);
      Object.assign(allPrices, batchPrices);
    }

    return allPrices;
  }

  private logSkipped(alert: PriceAlert, reason: string): void {
    this.logger.info(
      {
        event: LogEvent.PRICE_ALERT_SKIPPED,
        alertId: alert.id,
        userId: alert.userId,
        coinId: alert.coinId,
        reason
      },
      'Price alert skipped'
    );
  }
}
