import { PinoLogger } from 'nestjs-pino';
import { ActivityAction } from '../../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';
import {
  IUserActivityRepository,
  RecordActivityInput
} from '../../interfaces/activity.interface';
import { UserActivityRecorderService } from '../user-activity-recorder.service';

/** Lets the fire-and-forget promise inside `record` settle. */
const flush = () => new Promise(setImmediate);

describe('UserActivityRecorderService', () => {
  let service: UserActivityRecorderService;
  let repository: jest.Mocked<IUserActivityRepository>;
  let logger: { setContext: jest.Mock; error: jest.Mock };

  const validInput = (
    overrides: Partial<RecordActivityInput> = {}
  ): RecordActivityInput => ({
    userId: 'user-1',
    category: ActivityCategory.TRANSACTION,
    action: ActivityAction.CREATED,
    ...overrides
  });

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(undefined),
      findForUser: jest.fn()
    };
    logger = { setContext: jest.fn(), error: jest.fn() };

    service = new UserActivityRecorderService(
      repository,
      logger as unknown as PinoLogger
    );
  });

  describe('persisting', () => {
    it('writes the activity through the repository', async () => {
      service.record(
        validInput({ entityType: 'TRANSACTION', entityId: 'tx-1' })
      );
      await flush();

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        category: ActivityCategory.TRANSACTION,
        action: ActivityAction.CREATED,
        entityType: 'TRANSACTION',
        entityId: 'tx-1',
        metadata: null
      });
    });

    it('normalises absent optional fields to null', async () => {
      service.record(validInput());
      await flush();

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: null,
          entityId: null,
          metadata: null
        })
      );
    });

    it('passes display metadata through', async () => {
      service.record(
        validInput({ metadata: { assetSymbol: 'BTC', transactionType: 'BUY' } })
      );
      await flush();

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { assetSymbol: 'BTC', transactionType: 'BUY' }
        })
      );
    });
  });

  describe('metadata safety', () => {
    // The recorder screens before the repository does, so a call site that
    // passes something sensitive cannot reach the database with it even if the
    // repository's own screening were removed.
    it.each([
      ['password', { password: 'hunter2' }],
      ['accessToken', { accessToken: 'eyJhbGci' }],
      ['refreshToken', { refreshToken: 'abc' }],
      ['csrfToken', { csrfToken: 'xyz' }],
      ['cookie', { cookie: 'session=1' }],
      ['secret', { secret: 's3cr3t' }]
    ])('redacts %s', async (_name, metadata) => {
      service.record(validInput({ metadata }));
      await flush();

      const written = repository.create.mock.calls[0][0].metadata;

      expect(Object.values(written ?? {})).toEqual(['[REDACTED]']);
    });

    it('redacts a sensitive key nested inside metadata', async () => {
      service.record(
        validInput({ metadata: { outer: { password: 'hunter2', ok: 1 } } })
      );
      await flush();

      expect(repository.create.mock.calls[0][0].metadata).toEqual({
        outer: { password: '[REDACTED]', ok: 1 }
      });
    });
  });

  describe('validation', () => {
    it('refuses an activity with no user id', async () => {
      service.record(validInput({ userId: '' }));
      await flush();

      expect(repository.create).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    // `{ TRANSACTION, LOGIN }` is a call-site bug: it would persist a row no
    // UI can render and no filter would surface.
    it('refuses an action its category does not allow', async () => {
      service.record(
        validInput({
          category: ActivityCategory.TRANSACTION,
          action: ActivityAction.LOGIN
        })
      );
      await flush();

      expect(repository.create).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it.each([
      [ActivityCategory.SECURITY, ActivityAction.LOGIN],
      [ActivityCategory.SECURITY, ActivityAction.SESSION_REVOKED],
      [ActivityCategory.PORTFOLIO, ActivityAction.UPDATED],
      [ActivityCategory.TRANSACTION, ActivityAction.DELETED],
      [ActivityCategory.PRICE_ALERT, ActivityAction.DISABLED],
      [ActivityCategory.ACCOUNT, ActivityAction.PROFILE_UPDATED]
    ])('accepts the valid pair %s / %s', async (category, action) => {
      service.record(validInput({ category, action }));
      await flush();

      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it.each([
      [ActivityCategory.PORTFOLIO, ActivityAction.ENABLED],
      [ActivityCategory.ACCOUNT, ActivityAction.CREATED],
      [ActivityCategory.SECURITY, ActivityAction.UPDATED]
    ])('rejects the invalid pair %s / %s', async (category, action) => {
      service.record(validInput({ category, action }));
      await flush();

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('failure is contained', () => {
    /**
     * The whole contract. The business operation has already committed by the
     * time this runs, so a MongoDB outage must not surface as an error.
     */
    it('does not throw when the repository rejects', async () => {
      repository.create.mockRejectedValue(new Error('Mongo is down'));

      expect(() => service.record(validInput())).not.toThrow();
      await flush();
    });

    it('logs the failure instead of propagating it', async () => {
      repository.create.mockRejectedValue(new Error('Mongo is down'));

      service.record(validInput());
      await flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ActivityCategory.TRANSACTION,
          action: ActivityAction.CREATED,
          userId: 'user-1'
        }),
        expect.stringContaining('Failed to record user activity')
      );
    });

    // A rejected promise with no catch would take the process down under
    // Node's default unhandled-rejection policy.
    it('leaves no unhandled rejection behind', async () => {
      const unhandled = jest.fn();
      process.once('unhandledRejection', unhandled);

      repository.create.mockRejectedValue(new Error('Mongo is down'));
      service.record(validInput());
      await flush();
      await flush();

      expect(unhandled).not.toHaveBeenCalled();
      process.off('unhandledRejection', unhandled);
    });

    it('returns synchronously rather than handing back a promise', () => {
      expect(service.record(validInput())).toBeUndefined();
    });
  });
});
