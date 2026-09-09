import {
  COINGECKO_CLIENT,
  ICoinGeckoClient,
  IPriceCheckService,
  PRICE_CHECK_SERVICE
} from '@features/coin-tracker/application/interfaces/coin-tracker.interface';
import { Coin } from '@features/coin-tracker/domain/entities/coin.entity';
import { PriceAlert } from '@features/coin-tracker/domain/entities/price-alert.entity';
import { AlertDirection } from '@features/coin-tracker/domain/enums/alert-direction.enum';
import { AlertStatus } from '@features/coin-tracker/domain/enums/alert-status.enum';
import { AlertTriggerMode } from '@features/coin-tracker/domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '@features/coin-tracker/domain/enums/notification-channel.enum';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  createMigratedTestApp,
  releaseSmtpTransport
} from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import {
  EmailProcessorObserver,
  messageTypeOf,
  observeEmailProcessor
} from '../helpers/email-queue.helper';
import {
  Mailpit,
  recipientsOf,
  senderOf,
  uniqueRecipient
} from '../helpers/mailpit.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { expectNoSecrets } from '../helpers/secret-leak.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

/**
 * A price alert firing, all the way to the recipient's mailbox.
 *
 * The scheduler's own behaviour — when an alert crosses, how often, what it
 * does to the row — is covered by the coin-tracker specs, which stop at
 * `sendEmail`. This picks the flow up there: `EmailNotificationService`
 * publishes onto the same queue every other email uses, `EmailProcessor`
 * delivers it, and what a subscriber actually receives is what gets asserted.
 *
 * CoinGecko is stubbed, because a spec cannot make the market cross a price on
 * demand and an external HTTP dependency is not what is under test here. Every
 * link after that — the notification service, the queue, the processor, the
 * template, the transport — is the real one.
 */
describe('Price alert email delivery (e2e)', () => {
  const mailpit = new Mailpit();

  let app: INestApplication;
  let dataSource: DataSource;
  let processor: EmailProcessorObserver;

  const usedAddresses: string[] = [];

  const recipient = () => {
    const address = uniqueRecipient('price-alert');
    usedAddresses.push(address);

    return address;
  };

  beforeAll(async () => {
    await mailpit.assertReachable();

    processor = observeEmailProcessor();

    const context = await createMigratedTestApp({ email: 'delivered' });

    app = context.app;
    dataSource = context.dataSource;
  });

  afterAll(async () => {
    if (app) releaseSmtpTransport(app);

    await app?.close();

    processor?.stop();

    await Promise.all(
      usedAddresses.map((address) => mailpit.deleteMessagesTo(address))
    );
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);

    await dataSource.getRepository(Coin).save({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://example.test/bitcoin.png',
      isActive: true,
      lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
    });
  });

  /**
   * An active, verified account whose mailbox holds nothing yet.
   *
   * Registration delivers a verification email to the same address, so it is
   * waited for and cleared — otherwise "exactly one message" below would be
   * about two unrelated emails.
   */
  const subscriber = async (
    email: string
  ): Promise<AuthenticatedUserContext> => {
    const context = await AuthFactory.authenticated(app, {
      overrides: { email, username: 'alertsubscriber' }
    });

    await processor.waitForDelivery(email, {
      type: EmailMessageType.VERIFICATION
    });
    await mailpit.waitForMessages(email, 1);
    await mailpit.deleteMessagesTo(email);

    return context;
  };

  /** An alert one tick away from crossing its target upward. */
  const armAlert = async (
    context: AuthenticatedUserContext
  ): Promise<string> => {
    const created = await context.client.post('/v1/price-alerts', {
      headers: { 'X-CSRF-Token': context.response.headers.xCsrfToken },
      body: {
        coinId: 'bitcoin',
        targetPrice: 100,
        direction: AlertDirection.SELL,
        triggerMode: AlertTriggerMode.ONCE,
        expiresAt: '2099-01-01T00:00:00.000Z',
        notificationChannels: [NotificationChannel.EMAIL]
      }
    });

    expect(created.status).toBe(201);

    const alertId = created.body.id as string;

    // The last observed price sits below the target, so the next check is a
    // crossing rather than an alert that was already true.
    await dataSource
      .getRepository(PriceAlert)
      .update(alertId, { lastCheckedPrice: '99' });

    return alertId;
  };

  /** Runs one scheduler tick with the market at `usd`. */
  const checkPricesAt = async (usd: number): Promise<void> => {
    const coingecko = app.get<ICoinGeckoClient>(COINGECKO_CLIENT);
    const prices = jest
      .spyOn(coingecko, 'getPrices')
      .mockResolvedValue({ bitcoin: { usd } });

    try {
      await app.get<IPriceCheckService>(PRICE_CHECK_SERVICE).check();
    } finally {
      prices.mockRestore();
    }
  };

  it('delivers one price alert email through the queue when an alert fires', async () => {
    const email = recipient();
    const context = await subscriber(email);
    const alertId = await armAlert(context);

    await checkPricesAt(150);

    const job = await processor.waitForDelivery(email, {
      type: EmailMessageType.PRICE_ALERT
    });

    expect(messageTypeOf(job)).toBe(EmailMessageType.PRICE_ALERT);

    const [message] = await mailpit.waitForMessages(email, 1);

    expect(recipientsOf(message)).toEqual([email]);
    expect(senderOf(message)).toBe(process.env.EMAIL_FROM);
    expect(message.Subject).toBe('BTC risen to $150');

    await expect(mailpit.messageCount(email)).resolves.toBe(1);

    // The alert really fired; the email is not describing something that did
    // not happen.
    await expect(
      dataSource.getRepository(PriceAlert).findOneByOrFail({ id: alertId })
    ).resolves.toMatchObject({
      status: AlertStatus.TRIGGERED,
      lastCheckedPrice: '150'
    });
  });

  it('states what crossed, in which direction, and against which target', async () => {
    const email = recipient();
    const context = await subscriber(email);

    await armAlert(context);
    await checkPricesAt(150);
    await processor.waitForDelivery(email, {
      type: EmailMessageType.PRICE_ALERT
    });

    const [message] = await mailpit.waitForMessages(email, 1);

    expect(message.Text).toContain(
      'Bitcoin (BTC) has risen to $150, which is at or above your alert target of $100.'
    );
    expect(message.Text).toContain('Current price: $150');
    expect(message.Text).toContain('Your target: $100');

    expect(message.HTML).toContain('Bitcoin');
    expect(message.HTML).toContain('$150');
    expect(message.HTML).toContain('$100');
  });

  it('leaks no secret into the delivered message', async () => {
    const email = recipient();
    const context = await subscriber(email);

    await armAlert(context);
    await checkPricesAt(150);
    await processor.waitForDelivery(email, {
      type: EmailMessageType.PRICE_ALERT
    });

    const [message] = await mailpit.waitForMessages(email, 1);
    const raw = await mailpit.raw(message.ID);

    expectNoSecrets(raw, 'the delivered price alert email');
  });
});
