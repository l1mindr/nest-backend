import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AlertDirection } from '../../../../domain/enums/alert-direction.enum';
import { AlertTriggerMode } from '../../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
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
      // EMAIL, not SMS: this case previously used SMS, which the DTO now
      // rejects because no SMS transport exists (see
      // SUPPORTED_NOTIFICATION_CHANNELS). The case is about clearing
      // `expiresAt`, so the channel just needs to be a valid one.
      notificationChannels: [NotificationChannel.EMAIL]
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  // SMS remains a member of the enum — the column is a PostgreSQL enum array
  // and existing alerts may still carry it — but it is not deliverable:
  // `EmailNotificationService.sendSms` logs `channel_not_implemented` and
  // drops the request. Accepting it on write meant the API reported success
  // for a notification that would never arrive.
  it.each([
    [
      'create',
      () =>
        plainToInstance(CreatePriceAlertRequestDto, {
          coinId: 'bitcoin',
          targetPrice: 120000,
          direction: AlertDirection.SELL,
          triggerMode: AlertTriggerMode.ONCE,
          notificationChannels: [NotificationChannel.SMS]
        })
    ],
    [
      'update',
      () =>
        plainToInstance(UpdatePriceAlertRequestDto, {
          notificationChannels: [NotificationChannel.SMS]
        })
    ]
  ])(
    'should reject an unsupported notification channel on %s',
    async (_, build) => {
      const errors = await validate(build());

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'notificationChannels' })
        ])
      );
    }
  );

  it('should reject SMS even when combined with a supported channel', async () => {
    const dto = plainToInstance(UpdatePriceAlertRequestDto, {
      notificationChannels: [NotificationChannel.EMAIL, NotificationChannel.SMS]
    });

    // `{ each: true }` validates every element, so one bad member fails the
    // whole array rather than being silently dropped.
    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'notificationChannels' })
      ])
    );
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
