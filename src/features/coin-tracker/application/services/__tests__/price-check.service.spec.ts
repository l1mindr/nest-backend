import { ClockService } from '@infrastructure/clock/clock.service';
import { PriceAlert } from '../../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { PriceAlertEvaluatorService } from '../price-alert-evaluator.service';
import { PriceCheckService } from '../price-check.service';

describe('PriceCheckService', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  const coin = {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    isActive: true
  };
  const owner = { id: 'user-id', email: 'alert-owner@example.com' };
  const baseAlert = {
    id: 'alert-id',
    userId: 'user-id',
    coinId: 'bitcoin',
    direction: AlertDirection.SELL,
    targetPrice: '100.00000000',
    triggerMode: AlertTriggerMode.ONCE,
    status: AlertStatus.ACTIVE,
    expiresAt: null,
    notificationChannels: [NotificationChannel.EMAIL],
    notificationCooldownMinutes: 60,
    lastCheckedPrice: '90.00000000',
    lastTriggeredAt: null,
    triggeredCount: 0,
    coin,
    owner
  } as PriceAlert;
  const priceAlertRepository = {
    expireActiveAlerts: jest.fn(),
    findActiveCoinIdsForScheduler: jest.fn(),
    findActiveAlertsForScheduler: jest.fn(),
    updateOwned: jest.fn(),
    updateLastCheckedPrice: jest.fn(),
    markTriggered: jest.fn()
  };
  const coingeckoClient = {
    getPrices: jest.fn()
  };
  const notificationService = {
    sendEmail: jest.fn(),
    sendSms: jest.fn()
  };
  const clockService = {
    nowDate: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  let service: PriceCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(now);
    priceAlertRepository.expireActiveAlerts.mockResolvedValue([]);
    priceAlertRepository.findActiveCoinIdsForScheduler.mockResolvedValue([
      'bitcoin'
    ]);
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      baseAlert
    ]);
    priceAlertRepository.updateLastCheckedPrice.mockResolvedValue(true);
    priceAlertRepository.markTriggered.mockResolvedValue(true);
    coingeckoClient.getPrices.mockResolvedValue({ bitcoin: { usd: 100 } });
    notificationService.sendEmail.mockResolvedValue(undefined);
    notificationService.sendSms.mockResolvedValue(undefined);

    service = new PriceCheckService(
      priceAlertRepository as any,
      coingeckoClient as any,
      notificationService as any,
      clockService as unknown as ClockService,
      new PriceAlertEvaluatorService(),
      logger as any
    );
  });

  it('should trigger an ONCE alert only when the price crosses the target', async () => {
    await service.check();

    expect(coingeckoClient.getPrices).toHaveBeenCalledWith(['bitcoin']);
    expect(notificationService.sendEmail).toHaveBeenCalledWith({
      alertId: 'alert-id',
      userId: 'user-id',
      recipientEmail: 'alert-owner@example.com',
      coinId: 'bitcoin',
      coinName: 'Bitcoin',
      coinSymbol: 'btc',
      direction: AlertDirection.SELL,
      targetPrice: '100.00000000',
      currentPrice: '100',
      triggeredAt: now
    });
    expect(priceAlertRepository.markTriggered).toHaveBeenCalledWith(
      'alert-id',
      {
        lastCheckedPrice: '100',
        lastTriggeredAt: now,
        status: AlertStatus.TRIGGERED
      }
    );
  });

  it('should keep REPEAT alerts active and dispatch every configured channel', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      {
        ...baseAlert,
        triggerMode: AlertTriggerMode.REPEAT,
        notificationChannels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS
        ]
      }
    ]);

    await service.check();

    expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    expect(notificationService.sendSms).toHaveBeenCalledTimes(1);
    expect(priceAlertRepository.markTriggered).toHaveBeenCalledWith(
      'alert-id',
      expect.objectContaining({ status: AlertStatus.ACTIVE })
    );
  });

  it('should store a baseline without triggering when no previous price exists', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      { ...baseAlert, lastCheckedPrice: null }
    ]);

    await service.check();

    expect(priceAlertRepository.updateLastCheckedPrice).toHaveBeenCalledWith(
      'alert-id',
      '100'
    );
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.markTriggered).not.toHaveBeenCalled();
  });

  it('should skip a crossing inside the notification cooldown and update the price', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      {
        ...baseAlert,
        triggerMode: AlertTriggerMode.REPEAT,
        lastTriggeredAt: new Date('2026-07-28T07:30:01.000Z')
      }
    ]);

    await service.check();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.updateLastCheckedPrice).toHaveBeenCalledWith(
      'alert-id',
      '100'
    );
  });

  it('should expire alerts before requesting their prices', async () => {
    priceAlertRepository.expireActiveAlerts.mockResolvedValue([
      { id: 'expired-id', userId: 'user-id', coinId: 'bitcoin' }
    ]);
    priceAlertRepository.findActiveCoinIdsForScheduler.mockResolvedValue([]);
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([]);

    await service.check();

    expect(coingeckoClient.getPrices).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('should batch distinct price requests instead of fetching per alert', async () => {
    const coinIds = Array.from({ length: 51 }, (_, index) => `coin-${index}`);
    priceAlertRepository.findActiveCoinIdsForScheduler.mockResolvedValue(
      coinIds
    );
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([]);
    coingeckoClient.getPrices.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { usd: 1 }]))
    );

    await service.check();

    expect(coingeckoClient.getPrices).toHaveBeenCalledTimes(2);
    expect(coingeckoClient.getPrices.mock.calls[0][0]).toHaveLength(50);
    expect(coingeckoClient.getPrices.mock.calls[1][0]).toHaveLength(1);
  });

  it('should isolate a notification failure and leave the crossing retryable', async () => {
    notificationService.sendEmail.mockRejectedValue(
      new Error('provider unavailable')
    );

    await expect(service.check()).resolves.toBeUndefined();

    expect(priceAlertRepository.markTriggered).not.toHaveBeenCalled();
    expect(priceAlertRepository.updateLastCheckedPrice).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should notify when a BUY alert falls through its target', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      {
        ...baseAlert,
        direction: AlertDirection.BUY,
        targetPrice: '100.00000000',
        lastCheckedPrice: '110.00000000'
      }
    ]);
    coingeckoClient.getPrices.mockResolvedValue({ bitcoin: { usd: 95 } });

    await service.check();

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: AlertDirection.BUY,
        currentPrice: '95',
        recipientEmail: 'alert-owner@example.com'
      })
    );
    expect(priceAlertRepository.markTriggered).toHaveBeenCalledWith(
      'alert-id',
      expect.objectContaining({ status: AlertStatus.TRIGGERED })
    );
  });

  it('should not notify a BUY alert while the price stays above its target', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      {
        ...baseAlert,
        direction: AlertDirection.BUY,
        targetPrice: '100.00000000',
        lastCheckedPrice: '120.00000000'
      }
    ]);
    coingeckoClient.getPrices.mockResolvedValue({ bitcoin: { usd: 110 } });

    await service.check();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.markTriggered).not.toHaveBeenCalled();
    expect(priceAlertRepository.updateLastCheckedPrice).toHaveBeenCalledWith(
      'alert-id',
      '110'
    );
  });

  it('should not notify a SELL alert while the price stays below its target', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      { ...baseAlert, lastCheckedPrice: '80.00000000' }
    ]);
    coingeckoClient.getPrices.mockResolvedValue({ bitcoin: { usd: 90 } });

    await service.check();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.markTriggered).not.toHaveBeenCalled();
  });

  it('should leave an alert active when its owner has no resolvable address', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      { ...baseAlert, owner: null }
    ]);

    await service.check();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.markTriggered).not.toHaveBeenCalled();
    expect(priceAlertRepository.updateLastCheckedPrice).toHaveBeenCalledWith(
      'alert-id',
      '100'
    );
  });

  it('should dispatch SMS without an address when email is not selected', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      {
        ...baseAlert,
        owner: null,
        notificationChannels: [NotificationChannel.SMS]
      }
    ]);

    await service.check();

    expect(notificationService.sendSms).toHaveBeenCalledTimes(1);
    expect(priceAlertRepository.markTriggered).toHaveBeenCalled();
  });

  it('should skip active alerts whose synchronized coin is inactive', async () => {
    priceAlertRepository.findActiveAlertsForScheduler.mockResolvedValue([
      { ...baseAlert, coin: { ...coin, isActive: false } }
    ]);

    await service.check();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(priceAlertRepository.updateLastCheckedPrice).not.toHaveBeenCalled();
  });
});
