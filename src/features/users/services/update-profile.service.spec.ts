import { User } from '../entities/user.entity';
import { UserErrors } from '../errors/user-errors';
import { UpdateProfileService } from './update-profile.service';

describe('UpdateProfileService', () => {
  let service: UpdateProfileService;

  const mockUserRepository = {
    findById: jest.fn(),
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UpdateProfileService(mockUserRepository as any);
  });

  describe('updateProfile', () => {
    it('should update profile', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.update.mockResolvedValue(undefined);

      await service.updateProfile('1', { name: 'Ali' } as any);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('1');
      expect(mockUserRepository.update).toHaveBeenCalledWith('1', {
        name: 'Ali'
      });
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.updateProfile('1', {} as any)).rejects.toEqual(
        UserErrors.userNotFound('1')
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw emailAlreadyExists', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.update.mockRejectedValue({
        code: '23505',
        detail: 'email'
      });

      await expect(service.updateProfile('1', {} as any)).rejects.toEqual(
        UserErrors.emailAlreadyExists()
      );
    });

    it('should throw usernameAlreadyExists', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.update.mockRejectedValue({
        code: '23505',
        detail: 'username'
      });

      await expect(service.updateProfile('1', {} as any)).rejects.toEqual(
        UserErrors.usernameAlreadyExists()
      );
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('unknown');
      mockUserRepository.findById.mockResolvedValue({ id: '1' } as User);
      mockUserRepository.update.mockRejectedValue(error);

      await expect(service.updateProfile('1', {} as any)).rejects.toThrow(
        error
      );
    });
  });
});
