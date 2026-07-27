import { JwtService } from '@nestjs/jwt';
import { TokenIssueService } from '../../services/token-issue.service';

describe('TokenIssueService', () => {
  let service: TokenIssueService;

  const mockJwtService = {
    signAsync: jest.fn()
  };

  const jwtConfiguration = {
    secret: 'test-secret',
    accessTokenSecret: 'accessTokenSecret',
    refreshTokenSecret: 'refreshTokenSecret'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TokenIssueService(
      jwtConfiguration as any,
      mockJwtService as unknown as JwtService
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
});
