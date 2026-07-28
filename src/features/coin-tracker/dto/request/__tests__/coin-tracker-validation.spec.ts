import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AlertDirection } from '../../../enums/alert-direction.enum';
import { AlertTriggerMode } from '../../../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../enums/notification-channel.enum';
import { CoinListRequestDto } from '../coin-list.request.dto';
import { CreatePriceAlertRequestDto } from '../create-price-alert.request.dto';
import { UpdatePriceAlertRequestDto } from '../update-price-alert.request.dto';

describe('Coin Tracker request validation', () => {
  const validAlert = {
    coinId: 'bitcoin',
    targetPrice: 120000,
    direction: AlertDirection.SELL,
    triggerMode: AlertTriggerMode.ONCE,
    expiresAt: '2099-01-01T00:00:00.000Z',
    notificationChannels: [NotificationChannel.EMAIL]
  };

  async function validateCreate(overrides: Record<string, unknown> = {}) {
    return validate(
      plainToInstance(CreatePriceAlertRequestDto, {
        ...validAlert,
        ...overrides
      })
    );
  }

  it('should accept a valid alert and normalize its coin id', async () => {
    const dto = plainToInstance(CreatePriceAlertRequestDto, {
      ...validAlert,
      coinId: '  BitCoin '
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.coinId).toBe('bitcoin');
  });

  it.each([
    ['non-positive price', { targetPrice: 0 }, 'targetPrice'],
    ['missing coin', { coinId: '' }, 'coinId'],
    ['invalid direction', { direction: 'HOLD' }, 'direction'],
    ['invalid trigger mode', { triggerMode: 'FOREVER' }, 'triggerMode'],
    [
      'expired lifetime',
      { expiresAt: '2000-01-01T00:00:00.000Z' },
      'expiresAt'
    ],
    ['empty channels', { notificationChannels: [] }, 'notificationChannels'],
    [
      'unsupported channel',
      { notificationChannels: ['PUSH'] },
      'notificationChannels'
    ],
    [
      'duplicate channels',
      {
        notificationChannels: [
          NotificationChannel.EMAIL,
          NotificationChannel.EMAIL
        ]
      },
      'notificationChannels'
    ]
  ])('should reject %s', async (_, overrides, property) => {
    const errors = await validateCreate(overrides);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property })])
    );
  });

  it('should allow clearing expiration while validating update fields', async () => {
    const dto = plainToInstance(UpdatePriceAlertRequestDto, {
      expiresAt: null,
      targetPrice: 1,
      notificationChannels: [NotificationChannel.SMS]
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('should validate coin search pagination and sorting inputs', async () => {
    const dto = plainToInstance(CoinListRequestDto, {
      search: '  BTC ',
      limit: '10',
      sortBy: 'name',
      sortOrder: 'DESC'
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.search).toBe('btc');
    expect(dto.limit).toBe(10);
  });
});
