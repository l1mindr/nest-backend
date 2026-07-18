import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn()
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    service = new SessionsService(
      mockDataSource as unknown as DataSource,
      mockLogger as unknown as PinoLogger
    );
  });

  describe('issue', () => {
    it('should create and save session', async () => {
      const session = {
        id: 'session-id'
      } as Session;

      mockRepository.create.mockReturnValue(session);
      mockRepository.save.mockResolvedValue(session);
      mockRepository.find.mockResolvedValue([]);

      const result = await service.issue(
        'user-id',
        '127.0.0.1',
        {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        new Date()
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(session);
      expect(result).toEqual(session);
    });

    it('should enforce maximum active sessions and revoke oldest', async () => {
      process.env.MAX_ACTIVE_SESSIONS = '2';
      // active sessions ordered asc by createdAt: oldest first
      const active = [
        { id: 's1' } as Session,
        { id: 's2' } as Session,
        { id: 's3' } as Session
      ];
      mockRepository.create.mockReturnValue({ id: 'new' } as Session);
      mockRepository.save.mockResolvedValue({ id: 'new' } as Session);
      mockRepository.find.mockResolvedValue(active);

      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.issue(
        'user-id',
        '127.0.0.1',
        {} as any,
        new Date()
      );

      expect(mockRepository.find).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'new' });
      delete process.env.MAX_ACTIVE_SESSIONS;
    });
  });

  describe('getActive', () => {
    it('should return active session', async () => {
      const session = { id: '1' } as Session;

      mockRepository.findOne.mockResolvedValue(session);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toEqual(session);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    const device = {
      browserName: 'Chrome',
      browserVersion: '148.0.0',
      osName: 'MacOS',
      deviceType: 'desktop' as const
    };

    const currentSession = {
      id: 'current',
      ipAddress: '127.0.0.1',
      device,
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      lastUsedAt: new Date('2026-07-15T10:00:00.000Z')
    } as Session;

    const otherSession = {
      id: 'other',
      ipAddress: '10.0.0.2',
      device,
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
      lastUsedAt: new Date('2026-07-14T09:00:00.000Z')
    } as Session;

    it('should return explicitly mapped items with current session first', async () => {
      mockRepository.find.mockResolvedValue([otherSession]);

      const result = await service.list('user-id', currentSession);

      expect(result).toEqual([
        {
          sessionId: 'current',
          ipAddress: '127.0.0.1',
          deviceInfo: device,
          validUntil: currentSession.expiresAt,
          lastActivityAt: currentSession.lastUsedAt,
          current: true
        },
        {
          sessionId: 'other',
          ipAddress: '10.0.0.2',
          deviceInfo: device,
          validUntil: otherSession.expiresAt,
          lastActivityAt: otherSession.lastUsedAt
        }
      ]);
    });

    it('should select every field the response exposes', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            ipAddress: true,
            device: true,
            expiresAt: true,
            lastUsedAt: true
          }
        })
      );
    });
  });

  describe('revoke', () => {
    it('should revoke session', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.revoke('user-id', 'session-id');

      expect(mockRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          id: 'session-id'
        },
        {
          isRevoked: true
        }
      );
    });
  });

  describe('terminateOthers', () => {
    it('should revoke all other sessions', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.terminateOthers('user-id', 'current-session');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as unknown as EntityManager;

      await service.terminateOthers('user-id', 'current-session', manager);

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.update).toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateRefreshState', () => {
    it('should update session state', async () => {
      const session = {
        id: '1',
        isRevoked: false
      } as Session;

      mockRepository.save.mockResolvedValue(undefined);

      await service.updateRefreshState(session, {
        isRevoked: true
      });

      expect(session.isRevoked).toBe(true);

      expect(mockRepository.save).toHaveBeenCalledWith(session);
    });
  });

  describe('rotateRefreshToken', () => {
    it('should return true when update succeeds', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 1
      });

      const result = await service.rotateAtomic(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        {
          now: Date.now(),
          expiresAt: new Date()
        }
      );

      expect(result).toBe(true);
    });

    it('should return false when update affects no rows', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 0
      });

      const result = await service.rotateAtomic(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        {
          now: Date.now(),
          expiresAt: new Date()
        }
      );

      expect(result).toBe(false);
    });
  });
});
