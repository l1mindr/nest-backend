import { SessionErrors } from '@features/sessions/errors/session-errors';
import { ISessionRepository } from '@features/sessions/interfaces/sessions.interface';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { IUserRepository } from '@features/users/interfaces/users.interface';
import { JwtService } from '@nestjs/jwt';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { TokenErrors } from './errors/token-errors';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn()
  };

  const mockSessionRepository = {
    findActiveSession: jest.fn()
  };

  const mockUserRepository = {
    findUserForTokenValidation: jest.fn()
  };

  const jwtConfiguration = {
    secret: 'test-secret',
    accessTokenSecret: 'accessTokenSecret',
    refreshTokenSecret: 'refreshTokenSecret'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TokenService(
      jwtConfiguration as any,
      mockJwtService as unknown as JwtService,
      mockSessionRepository as unknown as ISessionRepository,
      mockUserRepository as unknown as IUserRepository
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
          secret: jwtConfiguration.accessTokenSecret,
          audience: 'api'
        }
      );

      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sub: 'user-id',
          sessionId: 'session-id'
        }),
        {
          secret: jwtConfiguration.refreshTokenSecret,
          audience: 'refresh'
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
        secret: jwtConfiguration.accessTokenSecret,
        audience: 'api'
      });
    });

    it.each([
      ['expired', new TokenExpiredError('jwt expired', new Date())],
      ['invalid signature', new JsonWebTokenError('invalid signature')],
      ['malformed', new JsonWebTokenError('jwt malformed')]
    ])(
      'should throw invalidToken when the token is %s',
      async (_case, jwtError) => {
        mockJwtService.verifyAsync.mockRejectedValue(jwtError);

        await expect(service.verifyAccessToken('token')).rejects.toThrow(
          TokenErrors.invalidToken()
        );
      }
    );
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
        secret: jwtConfiguration.refreshTokenSecret,
        audience: 'refresh'
      });
    });

    it.each([
      ['expired', new TokenExpiredError('jwt expired', new Date())],
      ['invalid signature', new JsonWebTokenError('invalid signature')],
      ['malformed', new JsonWebTokenError('jwt malformed')]
    ])(
      'should throw invalidToken when the token is %s',
      async (_case, jwtError) => {
        mockJwtService.verifyAsync.mockRejectedValue(jwtError);

        await expect(service.verifyRefreshToken('token')).rejects.toThrow(
          TokenErrors.invalidToken()
        );
      }
    );
  });

  describe('findUserAndActiveSession', () => {
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

      const result = await service.findUserAndActiveSession({
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
        service.findUserAndActiveSession({
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
          service.findUserAndActiveSession({
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
        service.findUserAndActiveSession({
          sub: 'user-id',
          sessionId: 'session-id'
        })
      ).rejects.toEqual(SessionErrors.sessionExpired('session-id'));
    });
  });
});
