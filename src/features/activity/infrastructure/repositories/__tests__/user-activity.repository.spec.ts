import { Model } from 'mongoose';
import { ClockService } from '@infrastructure/clock/clock.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { ACTIVITY_RETENTION_DAYS } from '../../../domain/activity-catalog';
import { ActivityAction } from '../../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';
import { UserActivity } from '../../schemas/user-activity.schema';
import { UserActivityRepository } from '../user-activity.repository';

/** Fixed instant so the retention arithmetic is checkable to the millisecond. */
const NOW_MS = Date.parse('2026-09-10T12:00:00.000Z');

describe('UserActivityRepository', () => {
  let repository: UserActivityRepository;
  let model: { create: jest.Mock; find: jest.Mock };
  let chain: {
    sort: jest.Mock;
    limit: jest.Mock;
    lean: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(() => {
    chain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };

    model = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue(chain)
    };

    const clock = new ClockService();
    jest.spyOn(clock, 'nowMs').mockReturnValue(NOW_MS);

    repository = new UserActivityRepository(
      model as unknown as Model<UserActivity>,
      clock
    );
  });

  describe('create', () => {
    const input = {
      userId: 'user-1',
      category: ActivityCategory.PORTFOLIO,
      action: ActivityAction.CREATED
    };

    it('persists the activity', async () => {
      await repository.create({
        ...input,
        entityType: 'PORTFOLIO',
        entityId: 'p-1',
        metadata: { portfolioName: 'Long Term' }
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          category: ActivityCategory.PORTFOLIO,
          action: ActivityAction.CREATED,
          entityType: 'PORTFOLIO',
          entityId: 'p-1',
          metadata: { portfolioName: 'Long Term' }
        })
      );
    });

    it('defaults the optional fields to null rather than leaving them absent', async () => {
      await repository.create(input);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: null,
          entityId: null,
          metadata: null
        })
      );
    });

    // The retention window is the point of the whole feature.
    it('sets expiresAt exactly 30 days after createdAt', async () => {
      await repository.create(input);

      const { createdAt, expiresAt } = model.create.mock.calls[0][0];

      expect(createdAt.toISOString()).toBe('2026-09-10T12:00:00.000Z');
      expect(expiresAt.getTime() - createdAt.getTime()).toBe(
        ACTIVITY_RETENTION_DAYS * TimeConstants.MS_PER_DAY
      );
      expect(expiresAt.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    });

    // Both timestamps come from one `now`, so the window cannot drift by the
    // time between two clock reads.
    it('derives both timestamps from a single instant', async () => {
      await repository.create(input);

      const { createdAt } = model.create.mock.calls[0][0];

      expect(createdAt.getTime()).toBe(NOW_MS);
    });

    it('redacts sensitive metadata at the boundary', async () => {
      await repository.create({
        ...input,
        metadata: { password: 'hunter2', portfolioName: 'Long Term' }
      });

      expect(model.create.mock.calls[0][0].metadata).toEqual({
        password: '[REDACTED]',
        portfolioName: 'Long Term'
      });
    });

    it('propagates a write failure to its caller', async () => {
      model.create.mockRejectedValue(new Error('Mongo is down'));

      await expect(repository.create(input)).rejects.toThrow('Mongo is down');
    });
  });

  describe('findForUser', () => {
    it('always constrains the query to the requested user', async () => {
      await repository.findForUser({ userId: 'user-1', limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('orders newest first, with the id breaking ties', async () => {
      await repository.findForUser({ userId: 'user-1', limit: 10 });

      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    });

    it('applies the requested limit', async () => {
      await repository.findForUser({ userId: 'user-1', limit: 21 });

      expect(chain.limit).toHaveBeenCalledWith(21);
    });

    it('adds the category filter only when one is asked for', async () => {
      await repository.findForUser({ userId: 'user-1', limit: 10 });
      expect(model.find.mock.calls[0][0]).not.toHaveProperty('category');

      await repository.findForUser({
        userId: 'user-1',
        limit: 10,
        category: ActivityCategory.SECURITY
      });
      expect(model.find.mock.calls[1][0]).toMatchObject({
        category: ActivityCategory.SECURITY
      });
    });

    it('translates a cursor into a strict "after this position" predicate', async () => {
      const createdAt = '2026-09-10T12:00:00.000Z';

      await repository.findForUser({
        userId: 'user-1',
        limit: 10,
        cursor: { createdAt, id: 'abc' }
      });

      expect(model.find.mock.calls[0][0]).toMatchObject({
        userId: 'user-1',
        $or: [
          { createdAt: { $lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), _id: { $lt: 'abc' } }
        ]
      });
    });

    it('keeps the user constraint alongside a cursor', async () => {
      await repository.findForUser({
        userId: 'user-1',
        limit: 10,
        cursor: { createdAt: '2026-09-10T12:00:00.000Z', id: 'abc' }
      });

      // The cursor must narrow the page, never widen it past the owner.
      expect(model.find.mock.calls[0][0].userId).toBe('user-1');
    });

    it('returns what the query yields', async () => {
      const documents = [{ _id: 'a' }, { _id: 'b' }];
      chain.exec.mockResolvedValue(documents);

      await expect(
        repository.findForUser({ userId: 'user-1', limit: 10 })
      ).resolves.toBe(documents);
    });
  });
});
