import { User } from '../../entities/user.entity';
import { UserErrors } from '../../errors/user-errors';
import { UpdateProfileService } from './update-profile.service';

describe('UpdateProfileService', () => {
  let service: UpdateProfileService;

  const mockUserRepository = {
    findUserById: jest.fn(),
    updateUserProfile: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UpdateProfileService(mockUserRepository as any);
  });

  describe('update', () => {
    it('should update profile', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockResolvedValue(undefined);

      await service.update('1', { name: 'Ali' } as any);

      expect(mockUserRepository.findUserById).toHaveBeenCalledWith('1');
      expect(mockUserRepository.updateUserProfile).toHaveBeenCalledWith('1', {
        name: 'Ali'
      });
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserById.mockResolvedValue(null);

      await expect(service.update('1', {} as any)).rejects.toEqual(
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

      await expect(service.update('1', {} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.update('1', {} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.findUserById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.updateUserProfile.mockRejectedValue(error);

      await expect(service.update('1', {} as any)).rejects.toThrow(error);
    });
  });
});
