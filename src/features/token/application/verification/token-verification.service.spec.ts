import { JwtService } from '@nestjs/jwt';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { TokenErrors } from '../../errors/token-errors';
import { TokenVerificationService } from './token-verification.service';

describe('TokenVerificationService', () => {
  let service: TokenVerificationService;

  const mockJwtService = {
    verifyAsync: jest.fn()
  };

  const jwtConfiguration = {
    secret: 'test-secret',
    accessTokenSecret: 'accessTokenSecret',
    refreshTokenSecret: 'refreshTokenSecret'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TokenVerificationService(
      jwtConfiguration as any,
      mockJwtService as unknown as JwtService
    );
  });

  describe('verifyAccess', () => {
    it('should verify access token', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyAccess('token');

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

        await expect(service.verifyAccess('token')).rejects.toThrow(
          TokenErrors.invalidToken()
        );
      }
    );
  });

  describe('verifyRefresh', () => {
    it('should verify refresh token', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyRefresh('token');

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

        await expect(service.verifyRefresh('token')).rejects.toThrow(
          TokenErrors.invalidToken()
        );
      }
    );
  });
});
