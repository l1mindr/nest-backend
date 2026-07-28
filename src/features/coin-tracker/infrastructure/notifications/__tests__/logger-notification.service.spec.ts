import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { LoggerNotificationService } from '../logger-notification.service';

describe('LoggerNotificationService', () => {
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };
  const payload = {
    userId: 'user-id',
    coinId: 'bitcoin',
    coinName: 'Bitcoin',
    direction: AlertDirection.SELL,
    targetPrice: '100',
    currentPrice: '101'
  };

  let service: LoggerNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoggerNotificationService(logger as any);
  });

  it('should log every email notification field', async () => {
    await service.sendEmail(payload);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        channel: NotificationChannel.EMAIL
      }),
      'Price alert notification dispatched'
    );
  });

  it('should log every SMS notification field', async () => {
    await service.sendSms(payload);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        channel: NotificationChannel.SMS
      }),
      'Price alert notification dispatched'
    );
  });
});
