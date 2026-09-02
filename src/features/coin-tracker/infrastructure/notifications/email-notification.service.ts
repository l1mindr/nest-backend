import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import {
  INotificationService,
  NotificationPayload
} from '../../application/interfaces/coin-tracker.interface';

/**
 * Delivers the notifications a fired price alert owes its owner.
 *
 * Email goes onto the shared email queue rather than to SMTP directly, for the
 * same reason every other flow in the project publishes: a scheduler tick
 * covering every active alert must not spend its minute inside nodemailer, and
 * a transient SMTP failure should cost a retry rather than a notification.
 *
 * SMS has no transport in this project. Rather than pretend otherwise, that
 * channel is recorded and dropped — see {@link sendSms}.
 */
@Injectable()
export class EmailNotificationService implements INotificationService {
  constructor(
    private readonly emailPublisher: EmailPublisher,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(EmailNotificationService.name);
  }

  async sendEmail(params: NotificationPayload): Promise<void> {
    await this.emailPublisher.publish(
      {
        type: EmailMessageType.PRICE_ALERT,
        to: params.recipientEmail,
        data: {
          coinName: params.coinName,
          coinSymbol: params.coinSymbol,
          direction: params.direction,
          targetPrice: params.targetPrice,
          currentPrice: params.currentPrice,
          triggeredAt: params.triggeredAt.toISOString()
        }
      },
      {
        // The alert and the instant it fired name the occasion: a scheduler
        // tick replayed after a crash publishes the same key and sends one
        // email. Neither part is a secret, which is what a key may be built
        // from.
        dedupeKey: emailDedupeKey(
          EmailMessageType.PRICE_ALERT,
          params.alertId,
          params.triggeredAt.toISOString()
        ),
        // Nothing has been written yet — the caller marks the alert triggered
        // only once this resolves, so a queue outage must be heard, not
        // swallowed.
        throwOnQueueFailure: true
      }
    );

    this.log(params, NotificationChannel.EMAIL);
  }

  /**
   * Records the request and delivers nothing.
   *
   * `NotificationChannel.SMS` is selectable on an alert but no SMS provider is
   * configured anywhere in this project, so there is no delivery to attempt.
   * Logged at warn level so that the gap shows up as a gap rather than passing
   * for a send.
   */
  async sendSms(params: NotificationPayload): Promise<void> {
    this.logger.warn(
      {
        event: LogEvent.NOTIFICATION_SENT,
        alertId: params.alertId,
        userId: params.userId,
        coinId: params.coinId,
        channel: NotificationChannel.SMS,
        reason: 'channel_not_implemented'
      },
      'SMS price alert notification requested but no SMS provider is configured'
    );
  }

  private log(params: NotificationPayload, channel: NotificationChannel): void {
    this.logger.info(
      {
        event: LogEvent.NOTIFICATION_SENT,
        alertId: params.alertId,
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
