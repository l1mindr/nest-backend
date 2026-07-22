import { ClockService } from '@core/clock/clock.service';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;
  const now = new Date('2026-07-21T08:00:00.000Z');
  const expiresAt = new Date('2026-07-28T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn(),
    dateFromMs: jest.fn()
  };

  const mockConfigService = {
    getOrThrow: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getOneOrFail: jest.fn(),
    leftJoinAndSelect: jest.fn().mockReturnThis()
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
    getRepository: jest.fn().mockReturnValue(mockRepository),
    transaction: jest.fn()
  };

  const mockTransactionManager = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockClockService.nowDate.mockReturnValue(now);
    mockClockService.dateFromMs.mockReturnValue(now);
    mockConfigService.getOrThrow.mockReturnValue(10);
    mockQueryBuilder.getOneOrFail.mockResolvedValue({ id: 'user-id' });
    mockDataSource.transaction.mockImplementation(async (callback) =>
      callback(mockTransactionManager)
    );

    service = new SessionsService(
      mockClockService as unknown as ClockService,
      mockConfigService as unknown as ConfigService,
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
        expiresAt
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(session);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: now })
      );
      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'MAX_ACTIVE_SESSIONS'
      );
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write'
      );
      expect(result).toEqual(session);
    });

    it('should revoke the least recently used session', async () => {
      mockConfigService.getOrThrow.mockReturnValue(2);
      const active = [
        { id: 'least-recently-used' } as Session,
        { id: 'recently-used' } as Session,
        { id: 'new' } as Session
      ];
      mockRepository.create.mockReturnValue({ id: 'new' } as Session);
      mockRepository.save.mockResolvedValue({ id: 'new' } as Session);
      mockRepository.find.mockResolvedValue(active);

      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.issue(
        'user-id',
        '127.0.0.1',
        {} as any,
        expiresAt
      );

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            lastUsedAt: 'ASC',
            createdAt: 'ASC',
            id: 'ASC'
          }
        })
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: expect.objectContaining({ value: ['least-recently-used'] }) },
        { isRevoked: true }
      );
      expect(result).toEqual({ id: 'new' });
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActive', () => {
    it('should return active session', async () => {
      const session = { id: '1' } as Session;

      mockRepository.findOne.mockResolvedValue(session);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toEqual(session);
      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserAndActiveSession', () => {
    it('should use the clock for the expiration comparison', async () => {
      const user = { id: 'user-id', sessions: [] };
      mockQueryBuilder.getOne.mockResolvedValue(user);

      await service.getUserAndActiveSession('user-id', 'session-id');

      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.sessions',
        'session',
        expect.any(String),
        { sessionId: 'session-id', now }
      );
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
      mockQueryBuilder.getMany.mockResolvedValue([otherSession]);

      const result = await service.list('user-id', currentSession);
      expect(result.currentSession).toEqual({
        sessionId: 'current',
        ipAddress: '127.0.0.1',
        deviceInfo: device,
        validUntil: currentSession.expiresAt,
        lastActivityAt: currentSession.lastUsedAt
      });
      expect(result.items).toEqual([
        {
          sessionId: 'other',
          ipAddress: '10.0.0.2',
          deviceInfo: device,
          validUntil: otherSession.expiresAt,
          lastActivityAt: otherSession.lastUsedAt
        }
      ]);
      expect(result.nextCursor).toBeNull();
      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
    });

    it('should use queryBuilder for session listing', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should order sessions deterministically by lastUsedAt, id', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'session.lastUsedAt',
        'ASC'
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'session.id',
        'ASC'
      );
    });

    it('should apply base filters for owner, active, expiration, and exclude current session', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.list('user-id', currentSession);

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
        { currentSessionId: 'current' }
      );
    });

    it('should use take + 1 to detect additional pages', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(21);
    });

    it('should return nextCursor when there are more results', async () => {
      const sessions = Array.from({ length: 21 }, (_, i) => ({
        id: `session-${String(i).padStart(2, '0')}`,
        ipAddress: '10.0.0.2',
        device,
        expiresAt: new Date('2026-08-02T00:00:00.000Z'),
        lastUsedAt: new Date(
          `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`
        ),
        createdAt: new Date(
          `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`
        )
      })) as unknown as Session[];

      mockQueryBuilder.getMany.mockResolvedValue(sessions);

      const result = await service.list('user-id', currentSession, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toEqual(expect.any(String));

      const decoded = JSON.parse(
        Buffer.from(result.nextCursor!, 'base64url').toString('utf-8')
      );
      expect(decoded.id).toBe('session-19');
    });

    it('should return null nextCursor when all results fit in one page', async () => {
      const sessions = [
        { ...otherSession, createdAt: new Date('2026-07-01T00:00:00.000Z') }
      ] as unknown as Session[];

      mockQueryBuilder.getMany.mockResolvedValue(sessions);

      const result = await service.list('user-id', currentSession, 20);

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('should apply cursor filter when cursor is provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const cursorPayload = {
        lastUsedAt: '2026-07-14T09:00:00.000Z',
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      };
      const cursor = Buffer.from(
        JSON.stringify(cursorPayload),
        'utf-8'
      ).toString('base64url');

      await service.list('user-id', currentSession, 20, cursor);

      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
      const cursorCall = andWhereCalls.find(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('cursorLastUsedAt')
      );

      expect(cursorCall).toBeDefined();
      expect(cursorCall[1]).toEqual({
        cursorLastUsedAt: new Date('2026-07-14T09:00:00.000Z'),
        cursorId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      });
    });

    it('should use default limit when limit is not provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(21);
    });

    it('should throw on invalid base64 cursor', async () => {
      await expect(
        service.list('user-id', currentSession, 20, '!!!invalid!!!')
      ).rejects.toThrow();
    });

    it('should throw when cursor decodes to non-JSON value', async () => {
      const cursor = Buffer.from('not-json', 'utf-8').toString('base64url');

      await expect(
        service.list('user-id', currentSession, 20, cursor)
      ).rejects.toThrow();
    });

    it('should throw when cursor has missing fields', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ lastUsedAt: '2026-07-14T09:00:00.000Z' }),
        'utf-8'
      ).toString('base64url');

      await expect(
        service.list('user-id', currentSession, 20, cursor)
      ).rejects.toThrow();
    });

    it('should throw when cursor id is not a UUID', async () => {
      const cursor = Buffer.from(
        JSON.stringify({
          lastUsedAt: '2026-07-14T09:00:00.000Z',
          id: 'not-a-uuid'
        }),
        'utf-8'
      ).toString('base64url');

      await expect(
        service.list('user-id', currentSession, 20, cursor)
      ).rejects.toThrow();
    });

    it('should throw when cursor has invalid timestamps', async () => {
      const cursor = Buffer.from(
        JSON.stringify({
          lastUsedAt: 'not-a-date',
          id: 'aaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        }),
        'utf-8'
      ).toString('base64url');

      await expect(
        service.list('user-id', currentSession, 20, cursor)
      ).rejects.toThrow();
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

  describe('revokeAllForUser', () => {
    it('should revoke every active session belonging to the user', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.revokeAllForUser('user-id');

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
      } as unknown as EntityManager;

      await service.revokeAllForUser('user-id', manager);

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

  describe('rotateAtomic', () => {
    it('should return true when update succeeds', async () => {
      const nowMs = 1710000000000;
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 1
      });

      const result = await service.rotateAtomic(
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

      const result = await service.rotateAtomic(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        {
          now: 1710000000000,
          expiresAt
        }
      );

      expect(result).toBe(false);
    });
  });
});
