import { ClockService } from '@core/clock/clock.service';
import { DataSource } from 'typeorm';
import { Session } from '../../entities/session.entity';
import { SessionRepository } from '../session.repository';

describe('SessionRepository', () => {
  let repository: SessionRepository;
  const now = new Date('2026-07-21T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn(),
    dateFromMs: jest.fn()
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOneOrFail: jest.fn(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    count: jest.fn()
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockDataSource = {
    getRepository: jest.fn(),
    transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClockService.nowDate.mockReturnValue(now);
    mockClockService.dateFromMs.mockReturnValue(now);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    mockDataSource.getRepository.mockReturnValue(mockRepository);

    repository = new SessionRepository(
      mockClockService as unknown as ClockService,
      mockDataSource as unknown as DataSource
    );
  });

  describe('findActiveSession', () => {
    it('should return active session', async () => {
      const session = { id: '1' } as Session;

      mockRepository.findOne.mockResolvedValue(session);

      const result = await repository.findActiveSession(
        'user-id',
        'session-id'
      );

      expect(result).toEqual(session);
      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findActiveSession(
        'user-id',
        'session-id'
      );

      expect(result).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should return true when update succeeds', async () => {
      const nowMs = 1710000000000;
      const expiresAt = new Date('2026-07-28T08:00:00.000Z');
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 1
      });

      const result = await repository.rotateRefreshToken(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        {
          now: nowMs,
          expiresAt
        }
      );

      expect(result).toBe(true);
      expect(mockClockService.dateFromMs).toHaveBeenCalledWith(nowMs);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          rotatedAt: now,
          lastUsedAt: now
        })
      );
    });

    it('should return false when update affects no rows', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 0
      });

      const result = await repository.rotateRefreshToken(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        {
          now: 1710000000000,
          expiresAt: new Date('2026-07-28T08:00:00.000Z')
        }
      );

      expect(result).toBe(false);
    });
  });

  describe('saveRefreshTokenHash', () => {
    it('should save a session', async () => {
      const session = { id: 'session-id' } as Session;
      mockRepository.save.mockResolvedValue(session);

      const result = await repository.saveRefreshTokenHash(session);

      expect(mockRepository.save).toHaveBeenCalledWith(session);
      expect(result).toEqual(session);
    });
  });

  describe('revokeSession', () => {
    it('should update session to revoked', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await repository.revokeSession('user-id', 'session-id');

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

  describe('revokeAllSessionsForUser', () => {
    it('should revoke all active sessions for user', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await repository.revokeAllSessionsForUser('user-id');

      expect(mockRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          isRevoked: false
        },
        {
          isRevoked: true
        }
      );
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as any;

      await repository.revokeAllSessionsForUser('user-id', manager);

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          isRevoked: false
        },
        {
          isRevoked: true
        }
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('terminateOtherSessions', () => {
    it('should revoke all other sessions', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await repository.revokeSessionsExceptCurrent(
        'user-id',
        'current-session'
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          id: expect.objectContaining({ _value: 'current-session' })
        },
        {
          isRevoked: true
        }
      );
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as any;

      await repository.revokeSessionsExceptCurrent(
        'user-id',
        'current-session',
        manager
      );

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.update).toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('listUserSessions', () => {
    it('should query sessions with correct filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.listUserSessions('user-id', 'current-session', {
        now,
        limit: 20
      });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'session.owner = :userId',
        { userId: 'user-id' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'session.isRevoked = false'
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'session.expiresAt > :now',
        { now }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'session.id != :currentSessionId',
        { currentSessionId: 'current-session' }
      );
    });

    it('should apply cursor filter when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      const cursor = {
        lastUsedAt: new Date('2026-07-14T09:00:00.000Z'),
        id: 'cursor-id'
      };

      await repository.listUserSessions('user-id', 'current-session', {
        now,
        limit: 20,
        cursor
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('cursorLastUsedAt'),
        {
          cursorLastUsedAt: cursor.lastUsedAt,
          cursorId: cursor.id
        }
      );
    });

    it('should return query results', async () => {
      const sessions = [{ id: 's1' }, { id: 's2' }] as Session[];
      mockQueryBuilder.getMany.mockResolvedValue(sessions);

      const result = await repository.listUserSessions('user-id', 'current', {
        now,
        limit: 20
      });

      expect(result).toEqual(sessions);
    });
  });

  describe('countActiveSessions', () => {
    it('should count active sessions for user', async () => {
      mockRepository.count.mockResolvedValue(3);

      const result = await repository.countActiveSessions('user-id', now);

      expect(result).toBe(3);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          owner: { id: 'user-id' },
          isRevoked: false,
          expiresAt: expect.anything()
        }
      });
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        count: jest.fn().mockResolvedValue(2)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as any;

      const result = await repository.countActiveSessions(
        'user-id',
        now,
        manager
      );

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.count).toHaveBeenCalled();
      expect(result).toBe(2);
      expect(mockRepository.count).not.toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create session using provided manager', async () => {
      const session = { id: 'new-session' } as Session;
      const mockTxRepo = {
        create: jest.fn().mockReturnValue(session),
        save: jest.fn().mockResolvedValue(session)
      };
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockTxRepo)
      };

      const result = await repository.createSession({
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        device: {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        expiresAt: new Date('2026-07-28T08:00:00.000Z'),
        now,
        manager: mockManager as any
      });

      expect(mockManager.getRepository).toHaveBeenCalledWith(Session);
      expect(mockTxRepo.save).toHaveBeenCalled();
      expect(result).toEqual(session);
    });

    it('should create session using default repository when no manager', async () => {
      const session = { id: 'new-session' } as Session;
      mockRepository.create.mockReturnValue(session);
      mockRepository.save.mockResolvedValue(session);

      const result = await repository.createSession({
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        device: {} as any,
        expiresAt: new Date('2026-07-28T08:00:00.000Z'),
        now
      });

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(session);
    });
  });
});
