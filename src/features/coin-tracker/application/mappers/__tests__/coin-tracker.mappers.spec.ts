import { Coin } from '../../../entities/coin.entity';
import { PriceAlert } from '../../../entities/price-alert.entity';
import { AlertDirection } from '../../../enums/alert-direction.enum';
import { AlertStatus } from '../../../enums/alert-status.enum';
import { AlertTriggerMode } from '../../../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../enums/notification-channel.enum';
import { CoinMapper } from '../coin.mapper';
import { PriceAlertMapper } from '../price-alert.mapper';

describe('Coin Tracker mappers', () => {
  const createdAt = new Date('2026-07-28T08:00:00.000Z');
  const updatedAt = new Date('2026-07-28T09:00:00.000Z');
  const coin = {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://example.test/bitcoin.png',
    isActive: true,
    lastSyncedAt: updatedAt,
    createdAt,
    updatedAt,
    internalOnly: 'excluded'
  } as Coin;

  it('should map coin response fields and exclude unknown values', () => {
    const result = new CoinMapper().toResponse(coin);

    expect(result).toEqual({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://example.test/bitcoin.png',
      isActive: true,
      lastSyncedAt: updatedAt,
      createdAt,
      updatedAt
    });
    expect(result).not.toHaveProperty('internalOnly');
  });

  it('should map alert fields without exposing ownership internals', () => {
    const alert = {
      id: '2ca4c45d-a1c3-41d4-a729-dd3532e9f61b',
      userId: '41b408d1-3873-43c7-a113-1e797f21f2f0',
      coinId: 'bitcoin',
      direction: AlertDirection.SELL,
      targetPrice: '120000',
      triggerMode: AlertTriggerMode.ONCE,
      status: AlertStatus.ACTIVE,
      expiresAt: null,
      notificationChannels: [NotificationChannel.EMAIL],
      notificationCooldownMinutes: 60,
      lastCheckedPrice: null,
      lastTriggeredAt: null,
      triggeredCount: 0,
      createdAt,
      updatedAt,
      coin
    } as PriceAlert;

    const result = new PriceAlertMapper().toResponse(alert);

    expect(result.id).toBe(alert.id);
    expect(result.targetPrice).toBe('120000');
    expect(result.coin).toMatchObject({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin'
    });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('owner');
  });
});
