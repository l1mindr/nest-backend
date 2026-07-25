import { ClockService } from '@core/clock/clock.service';
import { DataSource } from 'typeorm';
import { Session } from '../entities/session.entity';
import { ListSessionsService } from './list-sessions.service';

describe('ListSessionsService', () => {
  let service: ListSessionsService;
  const now = new Date('2026-07-21T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn()
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder)
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

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

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockClockService.nowDate.mockReturnValue(now);

    service = new ListSessionsService(
      mockClockService as unknown as ClockService,
      mockDataSource as unknown as DataSource
    );
  });

  describe('list', () => {
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
        (call: any[]) =>
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
});
