import { ClockService } from '@infrastructure/clock/clock.service';
import { PriceAlert } from '../../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { CoinTrackerErrorCode } from '../../../domain/errors/coin-tracker-error-code.enum';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { CreatePriceAlertUseCase } from '../create-price-alert.use-case';

describe('CreatePriceAlertUseCase', () => {
  const now = Date.parse('2026-07-28T08:00:00.000Z');
  const coin = {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    isActive: true
  };
  const alert = {
    id: 'alert-id',
    coinId: 'bitcoin',
    direction: AlertDirection.SELL,
    targetPrice: '120000',
    status: AlertStatus.ACTIVE
  } as PriceAlert;
  const priceAlertRepository = {
    create: jest.fn()
  };
  const coinRepository = {
    findActiveById: jest.fn()
  };
  const clockService = {
    nowMs: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: CreatePriceAlertUseCase;

  const activityRecorder = { record: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowMs.mockReturnValue(now);
    coinRepository.findActiveById.mockResolvedValue(coin);
    priceAlertRepository.create.mockResolvedValue(alert);

    useCase = new CreatePriceAlertUseCase(
      priceAlertRepository as any,
      coinRepository as any,
      clockService as unknown as ClockService,
      logger as any,
      activityRecorder as any
    );
  });

  it('should create an alert for an active synchronized coin', async () => {
    const result = await useCase.execute('user-id', {
      coinId: 'bitcoin',
      targetPrice: 120000,
      direction: AlertDirection.SELL,
      triggerMode: AlertTriggerMode.ONCE,
      expiresAt: '2026-08-01T00:00:00.000Z',
      notificationChannels: [NotificationChannel.EMAIL]
    });

    expect(coinRepository.findActiveById).toHaveBeenCalledWith('bitcoin');
    expect(priceAlertRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      coinId: 'bitcoin',
      targetPrice: '120000',
      direction: AlertDirection.SELL,
      triggerMode: AlertTriggerMode.ONCE,
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      notificationChannels: [NotificationChannel.EMAIL]
    });
    expect(result.coin).toBe(coin);
  });

  it('should reject inactive or unknown coins', async () => {
    coinRepository.findActiveById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', {
        coinId: 'removed-coin',
        targetPrice: 1,
        direction: AlertDirection.BUY,
        triggerMode: AlertTriggerMode.REPEAT,
        notificationChannels: [NotificationChannel.SMS]
      })
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.COIN_NOT_FOUND
    });

    expect(priceAlertRepository.create).not.toHaveBeenCalled();
  });

  it('should reject an expiration that is no longer in the future', async () => {
    await expect(
      useCase.execute('user-id', {
        coinId: 'bitcoin',
        targetPrice: 1,
        direction: AlertDirection.BUY,
        triggerMode: AlertTriggerMode.ONCE,
        expiresAt: '2026-07-28T07:59:59.000Z',
        notificationChannels: [NotificationChannel.EMAIL]
      })
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.INVALID_EXPIRATION
    });

    expect(coinRepository.findActiveById).not.toHaveBeenCalled();
  });

  describe('user activity', () => {
    const validDto = {
      coinId: 'bitcoin',
      targetPrice: 120000,
      direction: AlertDirection.SELL,
      triggerMode: AlertTriggerMode.ONCE,
      notificationChannels: [NotificationChannel.EMAIL]
    };

    it('records the alert once it exists', async () => {
      await useCase.execute('user-id', validDto);

      expect(activityRecorder.record).toHaveBeenCalledWith({
        userId: 'user-id',
        category: ActivityCategory.PRICE_ALERT,
        action: ActivityAction.CREATED,
        entityType: 'PRICE_ALERT',
        entityId: 'alert-id',
        metadata: { assetSymbol: 'btc', direction: AlertDirection.SELL }
      });
    });

    // The target price is a financial value the alert itself already holds.
    it('keeps the target price out of the metadata', async () => {
      await useCase.execute('user-id', validDto);

      const { metadata } = activityRecorder.record.mock.calls[0][0];

      expect(metadata).not.toHaveProperty('targetPrice');
    });

    it('records nothing when the coin is rejected', async () => {
      coinRepository.findActiveById.mockResolvedValue(null);

      await expect(useCase.execute('user-id', validDto)).rejects.toBeDefined();

      expect(activityRecorder.record).not.toHaveBeenCalled();
    });
  });
});
