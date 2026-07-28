import { IPriceCheckService } from '@features/coin-tracker/interfaces/coin-tracker.interface';
import {
  COINGECKO_CLIENT,
  ICoinGeckoClient,
  INotificationService,
  NOTIFICATION_SERVICE,
  PRICE_CHECK_SERVICE
} from '@features/coin-tracker/interfaces/coin-tracker.interface';
import { Coin } from '@features/coin-tracker/entities/coin.entity';
import { PriceAlert } from '@features/coin-tracker/entities/price-alert.entity';
import { AlertDirection } from '@features/coin-tracker/enums/alert-direction.enum';
import { AlertStatus } from '@features/coin-tracker/enums/alert-status.enum';
import { AlertTriggerMode } from '@features/coin-tracker/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '@features/coin-tracker/enums/notification-channel.enum';
import { User } from '@features/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Coin Tracker (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const createAlertBody = {
    coinId: 'bitcoin',
    targetPrice: 120000,
    direction: AlertDirection.SELL,
    triggerMode: AlertTriggerMode.ONCE,
    expiresAt: '2099-01-01T00:00:00.000Z',
    notificationChannels: [NotificationChannel.EMAIL]
  };

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    await seedCoins();
  });

  afterAll(async () => {
    await app?.close();
  });

  function mutationHeaders(context: AuthenticatedUserContext) {
    return {
      'X-CSRF-Token': context.response.headers.xCsrfToken
    };
  }

  async function seedCoins(): Promise<void> {
    const now = new Date('2026-07-28T08:00:00.000Z');

    await dataSource.getRepository(Coin).save([
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://example.test/bitcoin.png',
        isActive: true,
        lastSyncedAt: now
      },
      {
        id: 'bitcoin-cash',
        symbol: 'bch',
        name: 'Bitcoin Cash',
        image: null,
        isActive: true,
        lastSyncedAt: now
      },
      {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        image: 'https://example.test/ethereum.png',
        isActive: true,
        lastSyncedAt: now
      },
      {
        id: 'removed-coin',
        symbol: 'old',
        name: 'Removed Coin',
        image: null,
        isActive: false,
        lastSyncedAt: now
      }
    ]);
  }

  async function createAlert(
    context: AuthenticatedUserContext,
    overrides: Record<string, unknown> = {}
  ) {
    return context.client.post('/v1/price-alerts', {
      headers: mutationHeaders(context),
      body: {
        ...createAlertBody,
        ...overrides
      }
    });
  }

  async function userIdByEmail(email: string): Promise<string> {
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    return user.id;
  }

  it('should require authentication for coins and price alerts', async () => {
    const client = new ApiClient(app);

    const coins = await client.get('/v1/coins');
    const alerts = await client.get('/v1/price-alerts');
    const create = await client.post('/v1/price-alerts', {
      body: createAlertBody
    });

    expect(coins.status).toBe(401);
    expect(alerts.status).toBe(401);
    expect(create.status).toBe(401);
  });

  it('should search, sort, and paginate active synchronized coins', async () => {
    const { client } = await AuthFactory.authenticated(app);

    const firstPage = await client.get('/v1/coins', {
      query: {
        search: ' BIT ',
        sortBy: 'name',
        sortOrder: 'ASC',
        limit: 1
      }
    });

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.items).toHaveLength(1);
    expect(firstPage.body.data.items[0].id).toBe('bitcoin');
    expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));

    const secondPage = await client.get('/v1/coins', {
      query: {
        search: 'bit',
        sortBy: 'name',
        sortOrder: 'ASC',
        limit: 1,
        cursor: firstPage.body.data.nextCursor
      }
    });

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.items.map((coin: Coin) => coin.id)).toEqual([
      'bitcoin-cash'
    ]);
    expect(secondPage.body.data.nextCursor).toBeNull();
  });

  it('should create an alert for a synchronized active coin', async () => {
    const context = await AuthFactory.authenticated(app);
    const response = await createAlert(context);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      coinId: 'bitcoin',
      targetPrice: '120000',
      direction: AlertDirection.SELL,
      triggerMode: AlertTriggerMode.ONCE,
      status: AlertStatus.ACTIVE,
      notificationChannels: [NotificationChannel.EMAIL],
      notificationCooldownMinutes: 60,
      lastCheckedPrice: null,
      lastTriggeredAt: null,
      triggeredCount: 0,
      coin: {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin'
      }
    });
    expect(response.body.data).not.toHaveProperty('userId');

    const saved = await dataSource
      .getRepository(PriceAlert)
      .findOneByOrFail({ id: response.body.data.id });
    expect(saved.userId).toBe(await userIdByEmail(context.user.email));
  });

  it.each([
    ['non-positive target', { targetPrice: 0 }, 422],
    ['invalid direction', { direction: 'HOLD' }, 422],
    ['empty notification channels', { notificationChannels: [] }, 422],
    ['past expiration', { expiresAt: '2000-01-01T00:00:00.000Z' }, 422],
    ['unknown coin', { coinId: 'unknown-coin' }, 404],
    ['inactive coin', { coinId: 'removed-coin' }, 404]
  ])('should reject %s', async (_, overrides, status) => {
    const context = await AuthFactory.authenticated(app);

    const response = await createAlert(context, overrides);

    expect(response.status).toBe(status);
  });

  it('should update allowed fields and reset crossing state', async () => {
    const context = await AuthFactory.authenticated(app);
    const created = await createAlert(context);
    const alertId = created.body.data.id as string;

    await dataSource
      .getRepository(PriceAlert)
      .update(alertId, { lastCheckedPrice: '110000' });

    const response = await context.client.patch(`/v1/price-alerts/${alertId}`, {
      headers: mutationHeaders(context),
      body: {
        targetPrice: 90000,
        direction: AlertDirection.BUY,
        triggerMode: AlertTriggerMode.REPEAT,
        expiresAt: null,
        notificationChannels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS
        ]
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      targetPrice: '90000',
      direction: AlertDirection.BUY,
      triggerMode: AlertTriggerMode.REPEAT,
      expiresAt: null,
      notificationChannels: [
        NotificationChannel.EMAIL,
        NotificationChannel.SMS
      ],
      lastCheckedPrice: null
    });
  });

  it('should soft cancel an owned alert', async () => {
    const context = await AuthFactory.authenticated(app);
    const created = await createAlert(context);
    const alertId = created.body.data.id as string;

    const response = await context.client.delete(
      `/v1/price-alerts/${alertId}`,
      {
        headers: mutationHeaders(context)
      }
    );

    expect(response.status).toBe(204);
    await expect(
      dataSource.getRepository(PriceAlert).findOneByOrFail({ id: alertId })
    ).resolves.toMatchObject({ status: AlertStatus.CANCELLED });
  });

  it('should list only the current user alerts and apply filters', async () => {
    const owner = await AuthFactory.authenticated(app, {
      overrides: {
        email: 'owner@test.com',
        username: 'owner'
      }
    });
    const other = await AuthFactory.authenticated(app, {
      overrides: {
        email: 'other@test.com',
        username: 'other'
      }
    });

    await createAlert(owner);
    await createAlert(owner, {
      coinId: 'ethereum',
      direction: AlertDirection.BUY,
      targetPrice: 5000
    });
    await createAlert(other);

    const all = await owner.client.get('/v1/price-alerts');
    const filtered = await owner.client.get('/v1/price-alerts', {
      query: {
        direction: AlertDirection.BUY,
        status: AlertStatus.ACTIVE,
        coinId: 'ethereum'
      }
    });

    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(2);
    expect(
      all.body.data.items.every(
        (alert: Record<string, unknown>) => !('userId' in alert)
      )
    ).toBe(true);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0]).toMatchObject({
      coinId: 'ethereum',
      direction: AlertDirection.BUY,
      status: AlertStatus.ACTIVE
    });
  });

  it('should hide another user alert from update and delete operations', async () => {
    const owner = await AuthFactory.authenticated(app, {
      overrides: {
        email: 'owner@test.com',
        username: 'owner'
      }
    });
    const attacker = await AuthFactory.authenticated(app, {
      overrides: {
        email: 'attacker@test.com',
        username: 'attacker'
      }
    });
    const created = await createAlert(owner);
    const alertId = created.body.data.id as string;

    const update = await attacker.client.patch(`/v1/price-alerts/${alertId}`, {
      headers: mutationHeaders(attacker),
      body: { targetPrice: 1 }
    });
    const remove = await attacker.client.delete(`/v1/price-alerts/${alertId}`, {
      headers: mutationHeaders(attacker)
    });

    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    await expect(
      dataSource.getRepository(PriceAlert).findOneByOrFail({ id: alertId })
    ).resolves.toMatchObject({ status: AlertStatus.ACTIVE });
  });

  it('should expire active alerts before retrieving prices', async () => {
    const context = await AuthFactory.authenticated(app);
    const created = await createAlert(context);
    const alertId = created.body.data.id as string;
    await dataSource.getRepository(PriceAlert).update(alertId, {
      expiresAt: new Date('2000-01-01T00:00:00.000Z')
    });

    const coingeckoClient = app.get<ICoinGeckoClient>(COINGECKO_CLIENT);
    const priceSpy = jest.spyOn(coingeckoClient, 'getPrices');

    await app.get<IPriceCheckService>(PRICE_CHECK_SERVICE).check();

    await expect(
      dataSource.getRepository(PriceAlert).findOneByOrFail({ id: alertId })
    ).resolves.toMatchObject({ status: AlertStatus.EXPIRED });
    expect(priceSpy).not.toHaveBeenCalled();

    priceSpy.mockRestore();
  });

  it('should trigger an ONCE alert only after a threshold crossing', async () => {
    const context = await AuthFactory.authenticated(app);
    const created = await createAlert(context, { targetPrice: 100 });
    const alertId = created.body.data.id as string;
    await dataSource
      .getRepository(PriceAlert)
      .update(alertId, { lastCheckedPrice: '99' });

    const coingeckoClient = app.get<ICoinGeckoClient>(COINGECKO_CLIENT);
    const notificationService =
      app.get<INotificationService>(NOTIFICATION_SERVICE);
    const priceSpy = jest
      .spyOn(coingeckoClient, 'getPrices')
      .mockResolvedValue({ bitcoin: { usd: 100 } });
    const emailSpy = jest
      .spyOn(notificationService, 'sendEmail')
      .mockResolvedValue(undefined);
    const priceCheckService = app.get<IPriceCheckService>(PRICE_CHECK_SERVICE);

    await priceCheckService.check();
    await priceCheckService.check();

    const alert = await dataSource
      .getRepository(PriceAlert)
      .findOneByOrFail({ id: alertId });
    expect(alert).toMatchObject({
      status: AlertStatus.TRIGGERED,
      lastCheckedPrice: '100',
      triggeredCount: 1
    });
    expect(alert.lastTriggeredAt).toBeInstanceOf(Date);
    expect(priceSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: await userIdByEmail(context.user.email),
        coinId: 'bitcoin',
        direction: AlertDirection.SELL,
        targetPrice: '100',
        currentPrice: '100'
      })
    );

    priceSpy.mockRestore();
    emailSpy.mockRestore();
  });
});
