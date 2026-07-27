import { ClockService } from '@core/clock/clock.service';
import { DataSource } from 'typeorm';
import { Session } from '../../../entities/session.entity';
import { SessionIssueUseCase } from '../../use-cases/session-issue.use-case';

describe('SessionIssueUseCase', () => {
  const now = new Date('2026-07-21T08:00:00.000Z');
  const expiresAt = new Date('2026-07-28T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn(),
    snapshot: jest.fn(),
    dateFromMs: jest.fn()
  };

  const mockConfigService = {
    getOrThrow: jest.fn()
  };

  const mockSessionRepository = {
    createSession: jest.fn(),
    countActiveSessions: jest.fn()
  };

  const mockUserQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOneOrFail: jest.fn().mockResolvedValue({ id: 'user-id' })
  };

  const mockSessionQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([])
  };

  const mockManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity.name === 'User') {
        return { createQueryBuilder: jest.fn(() => mockUserQb) };
      }
      return {
        update: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest.fn(() => mockSessionQb)
      };
    })
  };

  const mockDataSource = {
    transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClockService.nowDate.mockReturnValue(now);
    mockClockService.snapshot.mockReturnValue({
      now: now.getTime(),
      expiresAt
    });
    mockClockService.dateFromMs.mockReturnValue(now);
    mockConfigService.getOrThrow.mockReturnValue(10);
    mockSessionRepository.createSession.mockResolvedValue({
      id: 'session-id'
    });
    mockSessionRepository.countActiveSessions.mockResolvedValue(1);

    mockDataSource.transaction.mockImplementation(async (callback) =>
      callback(mockManager)
    );
  });

  const service = new SessionIssueUseCase(
    mockClockService as unknown as ClockService,
    mockConfigService as any,
    mockDataSource as unknown as DataSource,
    mockSessionRepository as any
  );

  describe('execute', () => {
    it('should create and save session', async () => {
      const session = {
        id: 'session-id'
      } as Session;

      mockSessionRepository.createSession.mockResolvedValue(session);

      const result = await service.execute(
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

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'MAX_ACTIVE_SESSIONS'
      );
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        device: {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        expiresAt,
        now,
        manager: mockManager
      });
      expect(result).toEqual(session);
    });

    it('should lock the user row within transaction', async () => {
      await service.execute('user-id', '127.0.0.1', {} as any, expiresAt);

      expect(mockManager.getRepository).toHaveBeenCalled();
      expect(mockUserQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockUserQb.getOneOrFail).toHaveBeenCalled();
    });

    it('should enforce max sessions limit', async () => {
      mockConfigService.getOrThrow.mockReturnValue(2);
      mockSessionRepository.countActiveSessions.mockResolvedValue(3);
      mockSessionQb.getMany.mockResolvedValue([{ id: 'old1' }]);

      await service.execute('user-id', '127.0.0.1', {} as any, expiresAt);

      expect(mockSessionRepository.countActiveSessions).toHaveBeenCalledWith(
        'user-id',
        now,
        mockManager
      );
    });
  });
});
