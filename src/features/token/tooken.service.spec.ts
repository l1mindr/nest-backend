import { Test } from '@nestjs/testing';
import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';

describe('TokenService', () => {
  let service: TokenService;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn()
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: jwtService
        }
      ]
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.issuePair(
        'user-id',
        'session-id',
        Date.now(),
        new Date()
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('verify', () => {
    it('should verify access token payload', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyAccessToken('jwt-access-token');

      expect(result).toEqual(payload);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('jwt-access-token');
    });

    it('should verify refresh token payload', async () => {
      const payload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyRefreshToken('jwt-refresh-token');

      expect(result).toEqual(payload);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('jwt-refresh-token');
    });
  });
});
