import { User } from '@features/users/domain/entities/user.entity';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { EmailService } from '@infrastructure/email/email.service';
import { SmtpEmailService } from '@infrastructure/email/smtp-email.service';
import { BullEmailPublisher } from '@infrastructure/queue/email/bull-email.publisher';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  createMigratedTestApp,
  releaseSmtpTransport
} from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import {
  EmailProcessorObserver,
  messageTypeOf,
  observeEmailProcessor
} from '../helpers/email-queue.helper';
import {
  LogCapture,
  captureApplicationLogs
} from '../helpers/log-capture.helper';
import {
  Mailpit,
  MailpitMessage,
  recipientsOf,
  senderOf,
  uniqueRecipient
} from '../helpers/mailpit.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { digitSecret, expectNoSecrets } from '../helpers/secret-leak.helper';

/**
 * Registration, all the way to the message a new user opens.
 *
 * Every other spec that touches email stops at the publisher: the queue and the
 * provider are replaced with fakes, and the assertion is that a use case
 * *decided* to send. That leaves the second half untested — whether the job the
 * publisher wrote is one the worker can read, whether the template renders,
 * whether SMTP accepts it, whether the code that reaches the mailbox is the one
 * the database will verify. This spec runs that half against a real SMTP server
 * and reads the delivered message back out of it.
 *
 * Nothing between the HTTP request and the mailbox is substituted. The
 * publisher is `BullEmailPublisher`, the job crosses Redis, `EmailProcessor`
 * picks it up, `SmtpEmailService` renders it and nodemailer delivers it — the
 * assertions below check that wiring explicitly rather than assuming it.
 */
describe('Verification email delivery (e2e)', () => {
  const mailpit = new Mailpit();

  let app: INestApplication;
  let dataSource: DataSource;
  let processor: EmailProcessorObserver;
  let logs: LogCapture;

  /** Deleted afterwards; the mailbox is shared with every other Jest worker. */
  const usedAddresses: string[] = [];

  const recipient = (prefix = 'verification') => {
    const address = uniqueRecipient(prefix);
    usedAddresses.push(address);

    return address;
  };

  beforeAll(async () => {
    await mailpit.assertReachable();

    // Both start before the application does, so nothing the first flow logs or
    // delivers is missed.
    processor = observeEmailProcessor();
    logs = captureApplicationLogs();

    const context = await createMigratedTestApp({ email: 'delivered' });

    app = context.app;
    dataSource = context.dataSource;
  });

  afterAll(async () => {
    if (app) releaseSmtpTransport(app);

    await app?.close();

    processor?.stop();
    logs?.stop();

    await Promise.all(
      usedAddresses.map((address) => mailpit.deleteMessagesTo(address))
    );
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  const statusOf = async (email: string): Promise<UserStatus> => {
    const user = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email } });

    return user.status;
  };

  /** The code as a recipient would read it, not as the database stored it. */
  const codeFrom = (message: MailpitMessage): string => {
    const match = /Verification code:\s*(\d{6})/.exec(message.Text);

    if (!match) {
      throw new Error(
        'The delivered verification email does not contain a six-digit code.'
      );
    }

    return match[1];
  };

  it('runs the real pipeline rather than the capturing fakes', () => {
    // The rest of this file means nothing if the application under test is
    // still the one every other spec gets, so this is checked rather than
    // trusted.
    expect(app.get(EmailPublisher)).toBeInstanceOf(BullEmailPublisher);
    expect(app.get(EmailService)).toBeInstanceOf(SmtpEmailService);
  });

  it('delivers exactly one correctly addressed verification email', async () => {
    const email = recipient();

    const { response } = await UserFactory.register(app, {
      email,
      username: 'mailpituser'
    });

    expect(response.register.status).toBe(201);

    const job = await processor.waitForDelivery(email);

    // The message was produced by the queue worker, not by a use case reaching
    // for SMTP on the request path.
    expect(messageTypeOf(job)).toBe(EmailMessageType.VERIFICATION);
    expect(job.id).toEqual(expect.any(String));

    const [message] = await mailpit.waitForMessages(email, 1);

    expect(recipientsOf(message)).toEqual([email]);
    expect(senderOf(message)).toBe(process.env.EMAIL_FROM);
    expect(message.Subject).toBe(`Verify your ${process.env.APP_NAME} email`);

    // One registration, one email — a second copy would mean the job was
    // delivered twice, which recipients notice.
    await expect(mailpit.messageCount(email)).resolves.toBe(1);
  });

  it('carries the six-digit code in both the text and the HTML body', async () => {
    const email = recipient();

    await UserFactory.register(app, { email, username: 'mailpitcode' });
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const code = codeFrom(message);

    expect(code).toMatch(/^\d{6}$/);
    expect(message.HTML).toContain(code);
    expect(message.Text).toContain('expires in 3 minutes');
  });

  it('leaks no secret into the delivered message', async () => {
    const email = recipient();

    await UserFactory.register(app, { email, username: 'mailpitsecrets' });
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);

    // The raw source, so headers are covered as well as the body: SMTP
    // credentials would show up there if anywhere.
    const raw = await mailpit.raw(message.ID);

    expectNoSecrets(raw, 'the delivered verification email');
  });

  it('never writes the verification code to the application log', async () => {
    const email = recipient();

    await UserFactory.register(app, { email, username: 'mailpitlogs' });
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const code = codeFrom(message);

    // A check over an empty log would pass without proving anything.
    expect(logs.count()).toBeGreaterThan(0);

    expectNoSecrets(logs.text(), 'the application log', [
      digitSecret('the verification code', code)
    ]);
  });

  it('activates the account when the delivered code is used against the real API', async () => {
    const email = recipient();

    const { client, user } = await UserFactory.register(app, {
      email,
      username: 'mailpitverify'
    });

    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const code = codeFrom(message);

    expect(await statusOf(email)).toBe(UserStatus.PENDING_VERIFICATION);

    const verify = await client.post('/v1/auth/verify-email', {
      body: { email, code }
    });

    expect(verify.status).toBe(204);
    expect(await statusOf(email)).toBe(UserStatus.ACTIVATE);

    // The account is not merely flagged verified — it can be used.
    const login = await client.post('/v1/auth/login', {
      body: { email, password: user.password }
    });

    expect(login.status).toBe(200);
  });
});
