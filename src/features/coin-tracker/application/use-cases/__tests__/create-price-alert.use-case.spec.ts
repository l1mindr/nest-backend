import { ClockService } from '@core/clock/clock.service';
import { PriceAlert } from '../../../entities/price-alert.entity';
import { AlertDirection } from '../../../enums/alert-direction.enum';
import { AlertStatus } from '../../../enums/alert-status.enum';
import { AlertTriggerMode } from '../../../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../enums/notification-channel.enum';
import { CoinTrackerErrorCode } from '../../../errors/coin-tracker-error-code.enum';
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

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowMs.mockReturnValue(now);
    coinRepository.findActiveById.mockResolvedValue(coin);
    priceAlertRepository.create.mockResolvedValue(alert);

    useCase = new CreatePriceAlertUseCase(
      priceAlertRepository as any,
      coinRepository as any,
      clockService as unknown as ClockService,
      logger as any
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
});
