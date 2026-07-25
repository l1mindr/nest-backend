import { ClockService } from '@core/clock/clock.service';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Session } from '../entities/session.entity';
import { IssueSessionService } from './issue-session.service';

describe('IssueSessionService', () => {
  const now = new Date('2026-07-21T08:00:00.000Z');
  const expiresAt = new Date('2026-07-28T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockConfigService = {
    getOrThrow: jest.fn()
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOneOrFail: jest.fn()
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockTransactionManager = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  } as unknown as EntityManager;

  const mockDataSource = {
    transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClockService.nowDate.mockReturnValue(now);
    mockConfigService.getOrThrow.mockReturnValue(10);
    mockQueryBuilder.getOneOrFail.mockResolvedValue({ id: 'user-id' });
    (mockDataSource.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(mockTransactionManager)
    );
  });

  const service = new IssueSessionService(
    mockClockService as unknown as ClockService,
    mockConfigService as unknown as ConfigService,
    mockDataSource as unknown as DataSource
  );

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
});
