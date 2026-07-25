import { User } from '../entities/user.entity';
import { UserErrors } from '../errors/user-errors';
import { FindUserAdminService } from './find-user-admin.service';

describe('FindUserAdminService', () => {
  let service: FindUserAdminService;

  const mockUserRepository = {
    findUserForAdmin: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new FindUserAdminService(mockUserRepository as any);
  });

  describe('findUserById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findUserForAdmin.mockResolvedValue(user);

      const result = await service.findUserById('1');

      expect(result).toEqual(user);
      expect(mockUserRepository.findUserForAdmin).toHaveBeenCalledWith('1');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findUserForAdmin.mockResolvedValue(null);

      await expect(service.findUserById('missing')).rejects.toEqual(
        UserErrors.userNotFound('missing')
      );
    });
  });
});
