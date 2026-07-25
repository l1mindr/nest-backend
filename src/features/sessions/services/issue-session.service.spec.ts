import { ClockService } from '@core/clock/clock.service';
import { Session } from '../entities/session.entity';
import { IssueSessionService } from './issue-session.service';

describe('IssueSessionService', () => {
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
    createSession: jest.fn()
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
  });

  const service = new IssueSessionService(
    mockClockService as unknown as ClockService,
    mockConfigService as any,
    mockSessionRepository as any
  );

  describe('createSession', () => {
    it('should create and save session', async () => {
      const session = {
        id: 'session-id'
      } as Session;

      mockSessionRepository.createSession.mockResolvedValue(session);

      const result = await service.createSession(
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
        maxSessions: 10
      });
      expect(result).toEqual(session);
    });

    it('should revoke the least recently used session', async () => {
      mockConfigService.getOrThrow.mockReturnValue(2);

      mockSessionRepository.createSession.mockImplementation(async (params) => {
        expect(params.maxSessions).toBe(2);
        return { id: 'new' } as Session;
      });

      const result = await service.createSession(
        'user-id',
        '127.0.0.1',
        {} as any,
        expiresAt
      );

      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ maxSessions: 2 })
      );
      expect(result).toEqual({ id: 'new' });
    });
  });
});
