import { AppError } from '@core/errors/app.error';
import { ActivityAction } from '../../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';
import {
  IUserActivityRepository,
  UserActivityDocument
} from '../../interfaces/activity.interface';
import { UserActivityMapper } from '../../mappers/user-activity.mapper';
import { ListUserActivitiesUseCase } from '../list-user-activities.use-case';

const documentAt = (id: string, iso: string): UserActivityDocument => ({
  _id: id,
  userId: 'user-1',
  category: ActivityCategory.TRANSACTION,
  action: ActivityAction.CREATED,
  entityType: 'TRANSACTION',
  entityId: `tx-${id}`,
  metadata: { assetSymbol: 'BTC' },
  createdAt: new Date(iso),
  expiresAt: new Date('2026-10-10T12:00:00.000Z')
});

describe('ListUserActivitiesUseCase', () => {
  let useCase: ListUserActivitiesUseCase;
  let repository: jest.Mocked<IUserActivityRepository>;
  const mapper = new UserActivityMapper();

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findForUser: jest.fn().mockResolvedValue([])
    };
    useCase = new ListUserActivitiesUseCase(repository, mapper);
  });

  describe('user isolation', () => {
    /**
     * The identity is an argument, not a field of the query object, so there
     * is no shape a request could take that would reach the filter.
     */
    it('queries with the id it was given', async () => {
      await useCase.execute('user-1', {});

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('ignores a userId smuggled into the query object', async () => {
      await useCase.execute('user-1', {
        userId: 'user-2'
      } as never);

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' })
      );
    });
  });

  describe('paging', () => {
    it('asks for one more row than the page, to detect a next page', async () => {
      await useCase.execute('user-1', { limit: 20 });

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 21 })
      );
    });

    it('defaults the page size when none is given', async () => {
      await useCase.execute('user-1', {});

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 21 })
      );
    });

    it('clamps a page size above the maximum', async () => {
      await useCase.execute('user-1', { limit: 5000 });

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 101 })
      );
    });

    it('returns a full page and a cursor when there is more', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z'),
        documentAt('b', '2026-09-10T12:00:02.000Z'),
        documentAt('c', '2026-09-10T12:00:01.000Z')
      ]);

      const result = await useCase.execute('user-1', { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(result.nextCursor).not.toBeNull();
    });

    // The extra row is a probe, never part of the page.
    it('does not leak the probe row into the page', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z'),
        documentAt('b', '2026-09-10T12:00:02.000Z'),
        documentAt('c', '2026-09-10T12:00:01.000Z')
      ]);

      const result = await useCase.execute('user-1', { limit: 2 });

      expect(result.items.map((item) => item.id)).not.toContain('c');
    });

    it('ends the traversal with a null cursor', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z')
      ]);

      const result = await useCase.execute('user-1', { limit: 2 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns an empty page rather than failing when there is nothing', async () => {
      const result = await useCase.execute('user-1', {});

      expect(result).toEqual({ items: [], nextCursor: null });
    });

    // Round trip: the cursor a page emits must address the row after it.
    it('emits a cursor that points just past the last item returned', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z'),
        documentAt('b', '2026-09-10T12:00:02.000Z')
      ]);

      const { nextCursor } = await useCase.execute('user-1', { limit: 1 });

      await useCase.execute('user-1', { cursor: nextCursor as string });

      expect(repository.findForUser).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cursor: { createdAt: '2026-09-10T12:00:03.000Z', id: 'a' }
        })
      );
    });

    it('starts at the beginning when no cursor is given', async () => {
      await useCase.execute('user-1', {});

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: undefined })
      );
    });

    it.each(['not-base64url!!', 'YWJj', ''])(
      'rejects the unusable cursor %p',
      async (cursor) => {
        // An empty cursor is treated as "no cursor" rather than an error.
        if (cursor === '') {
          await expect(
            useCase.execute('user-1', { cursor })
          ).resolves.toBeDefined();
          return;
        }

        await expect(useCase.execute('user-1', { cursor })).rejects.toThrow(
          AppError
        );
      }
    );
  });

  describe('filtering', () => {
    it('passes a category through to the repository', async () => {
      await useCase.execute('user-1', {
        category: ActivityCategory.SECURITY
      });

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ category: ActivityCategory.SECURITY })
      );
    });

    it('leaves the category unset when none is asked for', async () => {
      await useCase.execute('user-1', {});

      expect(repository.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ category: undefined })
      );
    });
  });

  describe('the returned item', () => {
    it('exposes the display fields', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z')
      ]);

      const { items } = await useCase.execute('user-1', {});

      expect(items[0]).toEqual({
        id: 'a',
        category: ActivityCategory.TRANSACTION,
        action: ActivityAction.CREATED,
        entityType: 'TRANSACTION',
        entityId: 'tx-a',
        metadata: { assetSymbol: 'BTC' },
        createdAt: '2026-09-10T12:00:03.000Z'
      });
    });

    // Neither says anything the caller can act on, and `userId` is theirs.
    it('carries neither userId nor expiresAt', async () => {
      repository.findForUser.mockResolvedValue([
        documentAt('a', '2026-09-10T12:00:03.000Z')
      ]);

      const { items } = await useCase.execute('user-1', {});

      expect(items[0]).not.toHaveProperty('userId');
      expect(items[0]).not.toHaveProperty('expiresAt');
    });
  });
});
