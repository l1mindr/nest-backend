import { EmailMessageType } from '@infrastructure/email/email.message';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { NotificationPayload } from '../../../application/interfaces/coin-tracker.interface';
import { EmailNotificationService } from '../email-notification.service';

describe('EmailNotificationService', () => {
  const triggeredAt = new Date('2026-07-28T08:00:00.000Z');
  const payload: NotificationPayload = {
    alertId: 'alert-id',
    userId: 'user-id',
    recipientEmail: 'owner@example.com',
    coinId: 'bitcoin',
    coinName: 'Bitcoin',
    coinSymbol: 'btc',
    direction: AlertDirection.SELL,
    targetPrice: '100.00000000',
    currentPrice: '101.5',
    triggeredAt
  };
  const emailPublisher = { publish: jest.fn() };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  };

  let service: EmailNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailPublisher.publish.mockResolvedValue(undefined);
    service = new EmailNotificationService(
      emailPublisher as never,
      logger as never
    );
  });

  it('should publish the crossing to the recipient resolved by the scheduler', async () => {
    await service.sendEmail(payload);

    expect(emailPublisher.publish).toHaveBeenCalledWith(
      {
        type: EmailMessageType.PRICE_ALERT,
        to: 'owner@example.com',
        data: {
          coinName: 'Bitcoin',
          coinSymbol: 'btc',
          direction: AlertDirection.SELL,
          targetPrice: '100.00000000',
          currentPrice: '101.5',
          triggeredAt: '2026-07-28T08:00:00.000Z'
        }
      },
      expect.objectContaining({ throwOnQueueFailure: true })
    );
  });

  it('should key deduplication on the alert and the instant it fired', async () => {
    await service.sendEmail(payload);
    await service.sendEmail(payload);

    const [[, first], [, second]] = emailPublisher.publish.mock.calls;

    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(first.dedupeKey).toBe(
      'price-alert.alert-id.2026-07-28T08:00:00.000Z'
    );
  });

  it('should key a later crossing of the same alert separately', async () => {
    await service.sendEmail(payload);
    await service.sendEmail({
      ...payload,
      triggeredAt: new Date('2026-07-28T09:00:00.000Z')
    });

    const [[, first], [, second]] = emailPublisher.publish.mock.calls;

    expect(first.dedupeKey).not.toBe(second.dedupeKey);
  });

  it('should propagate an enqueue failure so the caller can retry the alert', async () => {
    emailPublisher.publish.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.sendEmail(payload)).rejects.toThrow(
      'redis unavailable'
    );
  });

  it('should keep the recipient address out of the dispatch log', async () => {
    await service.sendEmail(payload);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.info.mock.calls[0])).not.toContain(
      'owner@example.com'
    );
  });

  it('should record an SMS request as unimplemented rather than sending', async () => {
    await service.sendSms(payload);

    expect(emailPublisher.publish).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'channel_not_implemented' }),
      expect.any(String)
    );
  });
});
