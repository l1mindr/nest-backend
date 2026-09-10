import { ACTIVITY_RETENTION_DAYS } from '../../../domain/activity-catalog';
import { ActivityAction } from '../../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';
import { UserActivitySchema } from '../user-activity.schema';

/**
 * Retention is enforced by a MongoDB TTL index, so what has to be asserted is
 * the index *configuration* — waiting 30 days for a document to disappear is
 * not a test anyone can run.
 */
describe('UserActivitySchema', () => {
  const indexes = () =>
    UserActivitySchema.indexes() as unknown as Array<
      [Record<string, number>, Record<string, unknown>]
    >;

  describe('the TTL index', () => {
    const ttlIndex = () => indexes().find(([fields]) => 'expiresAt' in fields);

    it('exists, on expiresAt', () => {
      expect(ttlIndex()).toBeDefined();
      expect(ttlIndex()?.[0]).toEqual({ expiresAt: 1 });
    });

    /**
     * `expireAfterSeconds: 0` means "expire when the date in the field has
     * passed" rather than "expire zero seconds after insertion". Any other
     * value would add a second, undocumented delay on top of `expiresAt`.
     */
    it('expires on the value of the field, not on a fixed offset', () => {
      expect(ttlIndex()?.[1]).toMatchObject({ expireAfterSeconds: 0 });
    });
  });

  describe('the query index', () => {
    it('covers "one user, newest first"', () => {
      const found = indexes().find(
        ([fields]) => fields.userId === 1 && fields.createdAt === -1
      );

      expect(found).toBeDefined();
    });

    // Every extra index is paid for on each write; the read path needs two.
    it('adds nothing beyond the query and TTL indexes', () => {
      expect(indexes()).toHaveLength(2);
    });
  });

  describe('the document shape', () => {
    const path = (name: string) => UserActivitySchema.path(name);

    it.each(['userId', 'category', 'action', 'createdAt', 'expiresAt'])(
      'requires %s',
      (field) => {
        expect(path(field).isRequired).toBe(true);
      }
    );

    it.each(['entityType', 'entityId', 'metadata'])(
      'leaves %s optional',
      (field) => {
        expect(path(field).isRequired).toBeFalsy();
      }
    );

    it('constrains category and action to the known values', () => {
      expect(path('category').options.enum).toEqual(
        Object.values(ActivityCategory)
      );
      expect(path('action').options.enum).toEqual(
        Object.values(ActivityAction)
      );
    });

    it('writes to its own collection, not the audit log', () => {
      expect(UserActivitySchema.get('collection')).toBe('user_activities');
    });
  });

  it('documents a 30 day retention window', () => {
    expect(ACTIVITY_RETENTION_DAYS).toBe(30);
  });
});
