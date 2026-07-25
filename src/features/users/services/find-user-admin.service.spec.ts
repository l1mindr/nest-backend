import { User } from '../entities/user.entity';
import { UserErrors } from '../errors/user-errors';
import { FindUserAdminService } from './find-user-admin.service';

describe('FindUserAdminService', () => {
  let service: FindUserAdminService;

  const mockUserRepository = {
    findByIdForAdmin: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new FindUserAdminService(mockUserRepository as any);
  });

  describe('findById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findByIdForAdmin.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(result).toEqual(user);
      expect(mockUserRepository.findByIdForAdmin).toHaveBeenCalledWith('1');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findByIdForAdmin.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toEqual(
        UserErrors.userNotFound('missing')
      );
    });
  });
});
