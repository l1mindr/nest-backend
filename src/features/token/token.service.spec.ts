import { SessionErrors } from '@features/sessions/errors/session-errors';
import { SessionsService } from '@features/sessions/sessions.service';
import { UsersService } from '@features/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { TokenErrors } from './errors/token-errors';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn()
  };

  const mockUsersService = {
    findByIdForSessionValidation: jest.fn()
  };

  const mockSessionsService = {
    getActive: jest.fn()
  };

  const jwtConfiguration = {
    secret: 'test-secret'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TokenService(
      jwtConfiguration as any,
      mockJwtService as unknown as JwtService,
      mockUsersService as unknown as UsersService,
      mockSessionsService as unknown as SessionsService
    );
  });

  describe('issuePair', () => {
    it('should create access and refresh tokens', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const now = 1700000000000;
      const expiresAt = new Date(now + 1000);

      const result = await service.issuePair(
        'user-id',
        'session-id',
        now,
        expiresAt
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should sign tokens using configured secret', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await service.issuePair('user-id', 'session-id', Date.now(), new Date());

      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sub: 'user-id',
          sessionId: 'session-id'
        }),
        {
          secret: jwtConfiguration.secret
        }
      );

      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sub: 'user-id',
          sessionId: 'session-id'
        }),
        {
          secret: jwtConfiguration.secret
        }
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyAccessToken('token');

      expect(result).toEqual(payload);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('token', {
        secret: jwtConfiguration.secret
      });
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyRefreshToken('token');

      expect(result).toEqual(payload);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('token', {
        secret: jwtConfiguration.secret
      });
    });
  });

  describe('validatePayload', () => {
    it('should return user and session', async () => {
      const user = {
        id: 'user-id'
      };

      const session = {
        id: 'session-id'
      };

      mockUsersService.findByIdForSessionValidation.mockResolvedValue(user);

      mockSessionsService.getActive.mockResolvedValue(session);

      const result = await service.validatePayload({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      expect(result).toEqual({
        user,
        session
      });
    });

    it('should throw invalidToken when user does not exist', async () => {
      mockUsersService.findByIdForSessionValidation.mockResolvedValue(null);

      await expect(
        service.validatePayload({
          sub: 'user-id',
          sessionId: 'session-id'
        })
      ).rejects.toEqual(TokenErrors.invalidToken());
    });

    it('should throw sessionExpired when session does not exist', async () => {
      mockUsersService.findByIdForSessionValidation.mockResolvedValue({
        id: 'user-id'
      });

      mockSessionsService.getActive.mockResolvedValue(null);

      await expect(
        service.validatePayload({
          sub: 'user-id',
          sessionId: 'session-id'
        })
      ).rejects.toEqual(SessionErrors.sessionExpired('session-id'));
    });
  });
});
