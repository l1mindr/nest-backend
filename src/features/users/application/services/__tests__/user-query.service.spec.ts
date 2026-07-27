import { User } from '../../../entities/user.entity';
import { UserQueryService } from '../../services/user-query.service';

describe('UserQueryService', () => {
  let service: UserQueryService;

  const mockUserRepository = {
    findUserById: jest.fn(),
    findByEmailOrUsernameForAuth: jest.fn(),
    findUserForTokenValidation: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UserQueryService(mockUserRepository as any);
  });

  describe('findById', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findUserById.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(result).toEqual(user);
      expect(mockUserRepository.findUserById).toHaveBeenCalledWith('1');
    });

    it('should return null when not found', async () => {
      mockUserRepository.findUserById.mockResolvedValue(null);

      const result = await service.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrUsername', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(user);

      const result = await service.findByEmailOrUsername('test@test.com');

      expect(result).toEqual(user);
      expect(
        mockUserRepository.findByEmailOrUsernameForAuth
      ).toHaveBeenCalledWith('test@test.com');
    });

    it('should return null when not found', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);

      const result = await service.findByEmailOrUsername('missing@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findForTokenValidation', () => {
    it('should return user', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findUserForTokenValidation.mockResolvedValue(user);

      const result = await service.findForTokenValidation('1');

      expect(result).toEqual(user);
      expect(
        mockUserRepository.findUserForTokenValidation
      ).toHaveBeenCalledWith('1');
    });

    it('should return null when not found', async () => {
      mockUserRepository.findUserForTokenValidation.mockResolvedValue(null);

      const result = await service.findForTokenValidation('missing');

      expect(result).toBeNull();
    });
  });
});
