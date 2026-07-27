import { SessionErrors } from '@features/sessions/errors/session-errors';
import { ISessionRepository } from '@features/sessions/interfaces/sessions.interface';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { IUserRepository } from '@features/users/interfaces/users.interface';
import { TokenErrors } from '../../errors/token-errors';
import { TokenValidationService } from './token-validation.service';

describe('TokenValidationService', () => {
  let service: TokenValidationService;

  const mockSessionRepository = {
    findActiveSession: jest.fn()
  };

  const mockUserRepository = {
    findUserForTokenValidation: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TokenValidationService(
      mockUserRepository as unknown as IUserRepository,
      mockSessionRepository as unknown as ISessionRepository
    );
  });

  describe('validate', () => {
    it('should return user and session', async () => {
      const user = {
        id: 'user-id',
        status: UserStatus.ACTIVATE
      };

      const session = {
        id: 'session-id'
      };

      mockUserRepository.findUserForTokenValidation.mockResolvedValue(user);
      mockSessionRepository.findActiveSession.mockResolvedValue(session);

      const result = await service.validate({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      expect(result).toEqual({ user, session });
      expect(
        mockUserRepository.findUserForTokenValidation
      ).toHaveBeenCalledWith('user-id');
      expect(mockSessionRepository.findActiveSession).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });

    it('should throw invalidToken when user does not exist', async () => {
      mockUserRepository.findUserForTokenValidation.mockResolvedValue(null);

      await expect(
        service.validate({
          sub: 'user-id',
          sessionId: 'session-id'
        })
      ).rejects.toEqual(TokenErrors.invalidToken());
    });

    it.each([UserStatus.DEACTIVATE, UserStatus.SUSPEND])(
      'should throw invalidToken when the account is %s',
      async (status) => {
        mockUserRepository.findUserForTokenValidation.mockResolvedValue({
          id: 'user-id',
          status
        });
        mockSessionRepository.findActiveSession.mockResolvedValue({
          id: 'session-id'
        });

        await expect(
          service.validate({
            sub: 'user-id',
            sessionId: 'session-id'
          })
        ).rejects.toEqual(TokenErrors.invalidToken());
      }
    );

    it('should throw sessionExpired when session does not exist', async () => {
      mockUserRepository.findUserForTokenValidation.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVATE
      });
      mockSessionRepository.findActiveSession.mockResolvedValue(null);

      await expect(
        service.validate({
          sub: 'user-id',
          sessionId: 'session-id'
        })
      ).rejects.toEqual(SessionErrors.sessionExpired('session-id'));
    });
  });
});
