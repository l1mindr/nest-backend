import { IJwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
import { TokenService } from '@features/token/token.service';
import { User } from '@features/users/entities/user.entity';
import {
    InternalServerErrorException,
    UnauthorizedException
} from '@nestjs/common';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { IUserAgent } from './interfaces/session-user-agent.interface';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;

  let dataSource: jest.Mocked<DataSource>;
  let tokenService: jest.Mocked<TokenService>;

  let sessionRepo: jest.Mocked<Repository<Session>>;

  const hashingProvider = {
    hash: jest.fn(),
    compare: jest.fn()
  };

  beforeEach(() => {
    sessionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn()
    } as unknown as jest.Mocked<Repository<Session>>;

    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn().mockReturnValue(sessionRepo)
    } as unknown as jest.Mocked<DataSource>;

    tokenService = {
      issuePair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn()
    } as unknown as jest.Mocked<TokenService>;

    service = new SessionsService(
      dataSource,
      hashingProvider as any,
      tokenService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issue', () => {
    it('should create session and return tokens', async () => {
      const user = {
        id: 'user-id'
      } as User;

      const createdSession = {
        id: 'session-id'
      } as Session;

      const updatedSession = {
        ...createdSession,
        refreshTokenHash: 'hashed-refresh'
      } as Session;

      const saveMock = jest
        .fn()
        .mockResolvedValueOnce(createdSession)
        .mockResolvedValueOnce(updatedSession);

      dataSource.transaction.mockImplementation(async (callback: any) =>
        callback({
          getRepository: () => ({
            create: jest.fn((data) => data),
            save: saveMock
          })
        })
      );

      tokenService.issuePair.mockResolvedValueOnce({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      hashingProvider.hash.mockResolvedValue('hashed-refresh');

      const result = await service.issue(user.id, '127.0.0.1', {
        name: 'Chrome',
        version: '26'
      } as IUserAgent);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      expect(tokenService.issuePair).toHaveBeenCalledTimes(1);

      expect(hashingProvider.hash).toHaveBeenCalledWith('refresh-token');

      expect(saveMock).toHaveBeenCalledTimes(2);
    });

    it('should throw when session creation fails', async () => {
      dataSource.transaction.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.issue('user-id', '127.0.0.1', {} as IUserAgent)
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens', async () => {
      const session = {
        id: 'session-id',
        refreshTokenHash: 'hashed-refresh',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        owner: {
          id: 'user-id'
        }
      } as Session;

      const payload: IJwtPayload = {
        sub: 'user-id',
        sessionId: 'session-id'
      };

      tokenService.verifyRefreshToken.mockResolvedValue(payload);

      sessionRepo.findOne.mockResolvedValue(session);

      hashingProvider.compare.mockResolvedValue(true);

      tokenService.issuePair.mockResolvedValueOnce({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });
      hashingProvider.hash.mockResolvedValue('new-hashed-refresh');

      sessionRepo.save.mockResolvedValue(session);

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      expect(session.refreshTokenHash).toBe('new-hashed-refresh');

      expect(sessionRepo.save).toHaveBeenCalledWith(session);
    });

    it('should throw when session does not exist', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('refresh-token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should revoke session on token reuse detection', async () => {
      const session = {
        id: 'session-id',
        refreshTokenHash: 'hashed-refresh',
        isRevoked: false,
        expiresAt: new Date(),
        lastUsedAt: new Date(),
        owner: {
          id: 'user-id'
        }
      } as Session;

      tokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        sessionId: 'session-id'
      });

      sessionRepo.findOne.mockResolvedValue(session);

      hashingProvider.compare.mockResolvedValue(false);

      sessionRepo.save.mockImplementation(async (entity) => entity as Session);

      await expect(service.refresh('refresh-token')).rejects.toThrow(
        UnauthorizedException
      );

      expect(session.isRevoked).toBe(true);
      expect(sessionRepo.save).toHaveBeenCalledTimes(1);

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-id', isRevoked: true })
      );
    });
  });

  describe('getActive', () => {
    it('should return active session', async () => {
      const session = {
        id: 'session-id'
      } as Session;

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getActive('user-id', 'session-id');

      expect(sessionRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'session-id',
          owner: {
            id: 'user-id'
          },
          isRevoked: false,
          expiresAt: MoreThan(expect.any(Date))
        }
      });

      expect(result).toBe(session);
    });
  });

  describe('revoke', () => {
    it('should revoke session', async () => {
      await service.revoke({ id: 'user-id' } as User, 'session-id');

      expect(sessionRepo.update).toHaveBeenCalledWith(
        {
          id: 'session-id',
          owner: {
            id: 'user-id'
          }
        },
        {
          isRevoked: true
        }
      );
    });
  });

  describe('terminateOthers', () => {
    it('should revoke all sessions except current', async () => {
      await service.terminateOthers(
        { id: 'user-id' } as User,
        'current-session-id'
      );

      expect(sessionRepo.update).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return sessions with current flag', async () => {
      const user = {
        id: 'user-id'
      } as User;

      const currentSession = {
        id: 'current-session-id',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(),
        userAgent: {
          name: 'Chrome',
          version: '120'
        },
        lastUsedAt: new Date(),
        refreshTokenHash: 'refreshTokenHash',
        createdAt: new Date(),
        updatedAt: new Date(),
        isRevoked: false,
        owner: user
      };

      const dbSessions = [
        {
          id: 's1',
          ipAddress: '1.1.1.1',
          expiresAt: new Date(),
          userAgent: {
            name: 'Firefox',
            version: '118'
          },
          lastUsedAt: new Date()
        },
        {
          id: 's2',
          ipAddress: '2.2.2.2',
          expiresAt: new Date(),
          userAgent: {
            name: 'Safari',
            version: '17'
          },
          lastUsedAt: new Date()
        }
      ] as any;

      sessionRepo.find.mockResolvedValue(dbSessions);

      const result = await service.list({ user, session: currentSession });

      expect(sessionRepo.find).toHaveBeenCalled();

      expect(result[0]).toEqual(
        expect.objectContaining({
          sessionId: currentSession.id,
          ipAddress: currentSession.ipAddress,
          expiresAt: expect.any(Date),
          device: currentSession.userAgent,
          lastUsedAt: expect.any(Date),
          current: true
        })
      );

      expect(result[1]).toEqual(
        expect.objectContaining({
          sessionId: dbSessions[0].id,
          ipAddress: '1.1.1.1',
          device: dbSessions[0].userAgent,
          expiresAt: expect.any(Date),
          lastUsedAt: expect.any(Date)
        })
      );

      expect(result[2]).toEqual(
        expect.objectContaining({
          sessionId: dbSessions[1].id,
          ipAddress: '2.2.2.2',
          device: dbSessions[1].userAgent,
          expiresAt: expect.any(Date),
          lastUsedAt: expect.any(Date)
        })
      );

      expect(result).toHaveLength(3);
    });
  });
});
