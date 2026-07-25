import { ClockService } from '@core/clock/clock.service';
import { DataSource } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionRepository } from './session.repository';

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
    execute: jest.fn()
  };

  const mockRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockUserRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockDataSource = {
    getRepository: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClockService.nowDate.mockReturnValue(now);
    mockClockService.dateFromMs.mockReturnValue(now);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    mockDataSource.getRepository.mockImplementation((entity) => {
      if (entity.name === 'User') return mockUserRepository;
      return mockRepository;
    });

    repository = new SessionRepository(
      mockClockService as unknown as ClockService,
      mockDataSource as unknown as DataSource
    );
  });

  describe('getActive', () => {
    it('should return active session', async () => {
      const session = { id: '1' } as Session;

      mockRepository.findOne.mockResolvedValue(session);

      const result = await repository.getActive('user-id', 'session-id');

      expect(result).toEqual(session);
      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.getActive('user-id', 'session-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserAndActiveSession', () => {
    it('should use the clock for the expiration comparison', async () => {
      const user = { id: 'user-id', sessions: [] };
      mockQueryBuilder.getOne.mockResolvedValue(user);

      await repository.getUserAndActiveSession('user-id', 'session-id');

      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.sessions',
        'session',
        expect.any(String),
        { sessionId: 'session-id', now }
      );
    });
  });

  describe('rotateAtomic', () => {
    it('should return true when update succeeds', async () => {
      const nowMs = 1710000000000;
      const expiresAt = new Date('2026-07-28T08:00:00.000Z');
      mockQueryBuilder.execute.mockResolvedValue({
        affected: 1
      });

      const result = await repository.rotateAtomic(
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

      const result = await repository.rotateAtomic(
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
});
