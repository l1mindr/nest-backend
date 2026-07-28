import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import {
  INotificationService,
  NotificationPayload
} from '../../application/interfaces/coin-tracker.interface';

@Injectable()
export class LoggerNotificationService implements INotificationService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggerNotificationService.name);
  }

  async sendEmail(params: NotificationPayload): Promise<void> {
    this.log(params, NotificationChannel.EMAIL);
  }

  async sendSms(params: NotificationPayload): Promise<void> {
    this.log(params, NotificationChannel.SMS);
  }

  private log(params: NotificationPayload, channel: NotificationChannel): void {
    this.logger.info(
      {
        event: LogEvent.NOTIFICATION_SENT,
        userId: params.userId,
        coinId: params.coinId,
        coinName: params.coinName,
        direction: params.direction,
        targetPrice: params.targetPrice,
        currentPrice: params.currentPrice,
        channel
      },
      'Price alert notification dispatched'
    );
  }
}
