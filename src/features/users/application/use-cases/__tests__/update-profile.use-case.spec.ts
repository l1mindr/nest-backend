import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { User } from '../../../domain/entities/user.entity';
import { UserErrors } from '../../../domain/errors/user-errors';
import { UpdateProfileUseCase } from '../../use-cases/update-profile.use-case';

describe('UpdateProfileUseCase', () => {
  let service: UpdateProfileUseCase;

  const mockUserRepository = {
    findUserById: jest.fn(),
    updateUserProfile: jest.fn()
  };

  const mockActivityRecorder = { record: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UpdateProfileUseCase(
      mockUserRepository as any,
      mockActivityRecorder as any
    );
  });

  describe('execute', () => {
    it('should update profile', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockResolvedValue(undefined);

      await service.execute('1', { name: 'Ali' } as any);

      expect(mockUserRepository.findUserById).toHaveBeenCalledWith('1');
      expect(mockUserRepository.updateUserProfile).toHaveBeenCalledWith('1', {
        name: 'Ali'
      });
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserById.mockResolvedValue(null);

      await expect(service.execute('1', {} as any)).rejects.toEqual(
        UserErrors.userNotFound('1')
      );

      expect(mockUserRepository.updateUserProfile).not.toHaveBeenCalled();
    });

    it('should throw emailAlreadyExists', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.execute('1', {} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.execute('1', {} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue(error);

      await expect(service.execute('1', {} as any)).rejects.toThrow(error);
    });
  });

  describe('user activity', () => {
    it('records the update once it has been written', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockResolvedValue(undefined);

      await service.execute('1', { name: 'Ali', email: 'a@b.co' } as any);

      expect(mockActivityRecorder.record).toHaveBeenCalledWith({
        userId: '1',
        category: ActivityCategory.ACCOUNT,
        action: ActivityAction.PROFILE_UPDATED,
        entityType: 'USER',
        entityId: '1',
        // Which fields moved, never what they moved to.
        metadata: { updatedFields: ['email', 'name'] }
      });
    });

    it('records nothing when the user does not exist', async () => {
      mockUserRepository.findUserById.mockResolvedValue(null);

      await expect(service.execute('1', {} as any)).rejects.toBeDefined();

      expect(mockActivityRecorder.record).not.toHaveBeenCalled();
    });

    // The operation failed, so there is nothing to tell the user they did.
    it('records nothing when the write is rejected', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.execute('1', {} as any)).rejects.toBeDefined();

      expect(mockActivityRecorder.record).not.toHaveBeenCalled();
    });
  });
});
