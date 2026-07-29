import { ClockService } from '@infrastructure/services/clock.service';
import { PriceAlert } from '../../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { CoinTrackerErrorCode } from '../../../domain/errors/coin-tracker-error-code.enum';
import { UpdatePriceAlertUseCase } from '../update-price-alert.use-case';

describe('UpdatePriceAlertUseCase', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  const activeAlert = {
    id: 'alert-id',
    userId: 'user-id',
    coinId: 'bitcoin',
    status: AlertStatus.ACTIVE,
    expiresAt: new Date('2026-08-01T00:00:00.000Z')
  } as PriceAlert;
  const priceAlertRepository = {
    findByIdAndUser: jest.fn(),
    updateOwned: jest.fn()
  };
  const clockService = {
    nowDate: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: UpdatePriceAlertUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(now);
    priceAlertRepository.findByIdAndUser
      .mockResolvedValueOnce(activeAlert)
      .mockResolvedValueOnce({
        ...activeAlert,
        targetPrice: '90000',
        direction: AlertDirection.BUY
      });

    useCase = new UpdatePriceAlertUseCase(
      priceAlertRepository as any,
      clockService as unknown as ClockService,
      logger as any
    );
  });

  it('should update allowed fields and reset crossing state', async () => {
    await useCase.execute('alert-id', 'user-id', {
      targetPrice: 90000,
      direction: AlertDirection.BUY,
      triggerMode: AlertTriggerMode.REPEAT,
      expiresAt: null,
      notificationChannels: [NotificationChannel.EMAIL, NotificationChannel.SMS]
    });

    expect(priceAlertRepository.updateOwned).toHaveBeenCalledWith(
      'alert-id',
      'user-id',
      {
        targetPrice: '90000',
        direction: AlertDirection.BUY,
        triggerMode: AlertTriggerMode.REPEAT,
        expiresAt: null,
        notificationChannels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS
        ],
        lastCheckedPrice: null
      }
    );
  });

  it('should hide alerts owned by another user', async () => {
    priceAlertRepository.findByIdAndUser.mockReset().mockResolvedValue(null);

    await expect(
      useCase.execute('alert-id', 'other-user', { targetPrice: 1 })
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.PRICE_ALERT_NOT_FOUND
    });
  });

  it('should mark a stale active alert expired before rejecting the update', async () => {
    priceAlertRepository.findByIdAndUser.mockReset().mockResolvedValue({
      ...activeAlert,
      expiresAt: new Date('2026-07-28T07:00:00.000Z')
    });

    await expect(
      useCase.execute('alert-id', 'user-id', { targetPrice: 1 })
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.PRICE_ALERT_EXPIRED
    });
    expect(priceAlertRepository.updateOwned).toHaveBeenCalledWith(
      'alert-id',
      'user-id',
      { status: AlertStatus.EXPIRED }
    );
  });

  it.each([
    [AlertStatus.EXPIRED, CoinTrackerErrorCode.PRICE_ALERT_EXPIRED],
    [AlertStatus.CANCELLED, CoinTrackerErrorCode.PRICE_ALERT_CANCELLED],
    [AlertStatus.TRIGGERED, CoinTrackerErrorCode.PRICE_ALERT_TRIGGERED]
  ])('should reject terminal status %s', async (status, code) => {
    priceAlertRepository.findByIdAndUser.mockReset().mockResolvedValue({
      ...activeAlert,
      status
    });

    await expect(
      useCase.execute('alert-id', 'user-id', { targetPrice: 1 })
    ).rejects.toMatchObject({ code });
  });

  it('should reject an empty update', async () => {
    await expect(
      useCase.execute('alert-id', 'user-id', {})
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.EMPTY_UPDATE
    });

    expect(priceAlertRepository.findByIdAndUser).not.toHaveBeenCalled();
  });
});
