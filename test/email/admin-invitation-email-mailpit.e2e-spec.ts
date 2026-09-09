import { AdminInvitation } from '@features/authorization/domain/entities/admin-invitation.entity';
import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  createMigratedTestApp,
  releaseSmtpTransport
} from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
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
import { expectNoSecrets } from '../helpers/secret-leak.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

/**
 * The administrator invitation, delivered.
 *
 * The token is the entire credential: whoever holds it becomes an
 * administrator. It is never returned to the inviter, never written to the
 * response and stored only as a hash, so the delivered email is the one place
 * it exists in the clear — which makes "did the right token reach the right
 * mailbox, and nowhere else" a question only a real mailbox can answer.
 *
 * The token this spec extracts is never printed, asserted against a literal, or
 * put in a failure message. It is proved correct by using it: an invitation
 * that can be accepted is one whose token was delivered intact.
 */
describe('Admin invitation email delivery (e2e)', () => {
  const mailpit = new Mailpit();

  const ADMINS = '/v1/admin/administrators';
  const INVITATIONS = `${ADMINS}/invitations`;
  const ACCEPT = `${INVITATIONS}/accept`;

  let app: INestApplication;
  let dataSource: DataSource;
  let processor: EmailProcessorObserver;
  let logs: LogCapture;

  const usedAddresses: string[] = [];

  const recipient = () => {
    const address = uniqueRecipient('invitation');
    usedAddresses.push(address);

    return address;
  };

  beforeAll(async () => {
    await mailpit.assertReachable();

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

  const owner = () =>
    AuthFactory.authenticated(app, { withRole: UserRole.OWNER }, dataSource);

  const invite = (
    context: AuthenticatedUserContext,
    email: string,
    permissions: Permission[] = [Permission.USER_READ]
  ) =>
    context.client.post(INVITATIONS, {
      headers: { 'x-csrf-token': context.response.headers.xCsrfToken },
      body: { email, permissions }
    });

  /**
   * The value side of one of the inviter's auth cookies.
   *
   * `response.cookies` holds them as `name=value`, which would never appear in
   * an email as a whole; the value on its own is the thing worth searching for.
   */
  const cookieValue = (
    name: 'refresh_token' | 'csrf_token',
    context: AuthenticatedUserContext
  ): string => {
    const cookie =
      name === 'refresh_token'
        ? context.response.cookies.refreshToken
        : context.response.cookies.csrfToken;

    return cookie.slice(cookie.indexOf('=') + 1);
  };

  /** The token as the invitee reads it out of their email. */
  const tokenFrom = (message: MailpitMessage): string => {
    const match = /Invitation token:\s*(\S+)/.exec(message.Text);

    if (!match) {
      throw new Error(
        'The delivered invitation email does not contain an invitation token.'
      );
    }

    return match[1];
  };

  it('delivers exactly one invitation email, correctly addressed', async () => {
    const ownerContext = await owner();
    const email = recipient();

    const res = await invite(ownerContext, email);

    expect(res.status).toBe(201);

    const job = await processor.waitForDelivery(email);

    expect(messageTypeOf(job)).toBe(EmailMessageType.ADMIN_INVITATION);

    const [message] = await mailpit.waitForMessages(email, 1);

    expect(recipientsOf(message)).toEqual([email]);
    expect(senderOf(message)).toBe(process.env.EMAIL_FROM);
    expect(message.Subject).toBe(
      `You have been invited to administer ${process.env.APP_NAME}`
    );

    await expect(mailpit.messageCount(email)).resolves.toBe(1);
  });

  it('carries a token that the accept endpoint recognises', async () => {
    const ownerContext = await owner();
    const email = recipient();

    await invite(ownerContext, email, [
      Permission.USER_READ,
      Permission.USER_SUSPEND
    ]);
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const token = tokenFrom(message);

    // Present in both renderings, and never anything as short as a placeholder.
    expect(token.length).toBeGreaterThanOrEqual(16);
    expect(message.HTML).toContain(token);

    // Only the hash is stored, so a token that opens the invitation is a token
    // that arrived intact — the strongest available check, and one that needs
    // no comparison against a literal.
    const stored = await dataSource
      .getRepository(AdminInvitation)
      .findOneOrFail({ where: { email } });

    expect(stored.tokenHash).not.toBe(token);

    const accept = await new ApiClient(app).post(ACCEPT, {
      body: {
        token,
        username: 'invited_by_mailpit',
        password: 'Password@123',
        name: 'Invited Admin'
      }
    });

    expect(accept.status).toBe(204);

    const created = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email } });

    expect(created.role).toBe(UserRole.ADMIN);
    expect(created.status).toBe(UserStatus.ACTIVATE);
  });

  it('leaks no secret into the delivered message', async () => {
    const ownerContext = await owner();
    const email = recipient();

    await invite(ownerContext, email);
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const raw = await mailpit.raw(message.ID);

    // Configured secrets, plus the session material of the administrator who
    // issued the invitation: this is the one flow in the set that runs on an
    // authenticated request, so it is where a leaked cookie could come from.
    expectNoSecrets(raw, 'the delivered invitation email', [
      {
        name: "the inviter's refresh token",
        value: cookieValue('refresh_token', ownerContext)
      },
      {
        name: "the inviter's CSRF token",
        value: ownerContext.response.headers.xCsrfToken
      }
    ]);

    // The invitation names no one: not the owner who sent it, not the
    // administrators it joins. A misdirected copy discloses nothing about them.
    expect(raw).not.toContain(ownerContext.user.email);
    expect(raw).not.toContain(ownerContext.user.username);
  });

  it('never writes the invitation token to the application log', async () => {
    const ownerContext = await owner();
    const email = recipient();

    await invite(ownerContext, email);
    await processor.waitForDelivery(email);

    const [message] = await mailpit.waitForMessages(email, 1);
    const token = tokenFrom(message);

    expect(logs.count()).toBeGreaterThan(0);

    // The token is high-entropy, so a plain containment check cannot produce a
    // false positive the way a six-digit code could.
    expectNoSecrets(logs.text(), 'the application log', [
      { name: 'the invitation token', value: token }
    ]);
  });
});
