import { ClockService } from '@core/clock/clock.service';
import { Session } from '../../../domain/entities/session.entity';
import { SessionCursorService } from '../../services/session-cursor.service';
import { SessionListService } from '../../services/session-list.service';

describe('SessionListService', () => {
  let service: SessionListService;
  const now = new Date('2026-07-21T08:00:00.000Z');

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockSessionRepository = {
    listUserSessions: jest.fn()
  };

  const mockCursorService = {
    encode: jest.fn(),
    decode: jest.fn()
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

    mockClockService.nowDate.mockReturnValue(now);
    mockCursorService.decode.mockReturnValue(null);
    mockCursorService.encode.mockImplementation((data) =>
      Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url')
    );

    service = new SessionListService(
      mockClockService as unknown as ClockService,
      mockCursorService as unknown as SessionCursorService,
      mockSessionRepository as any
    );
  });

  describe('list', () => {
    it('should return explicitly mapped items with current session first', async () => {
      mockSessionRepository.listUserSessions.mockResolvedValue([otherSession]);

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

    it('should use repository for session listing', async () => {
      mockSessionRepository.listUserSessions.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockSessionRepository.listUserSessions).toHaveBeenCalledWith(
        'user-id',
        'current',
        expect.objectContaining({ now, limit: 20 })
      );
    });

    it('should decode cursor via cursor service', async () => {
      mockSessionRepository.listUserSessions.mockResolvedValue([]);
      const cursorData = {
        lastUsedAt: new Date('2026-07-14T09:00:00.000Z'),
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      };
      mockCursorService.decode.mockReturnValue(cursorData);

      await service.list('user-id', currentSession, 20, 'some-cursor');

      expect(mockCursorService.decode).toHaveBeenCalledWith('some-cursor');
      expect(mockSessionRepository.listUserSessions).toHaveBeenCalledWith(
        'user-id',
        'current',
        expect.objectContaining({ cursor: cursorData })
      );
    });

    it('should use default limit when limit is not provided', async () => {
      mockSessionRepository.listUserSessions.mockResolvedValue([]);

      await service.list('user-id', currentSession);

      expect(mockSessionRepository.listUserSessions).toHaveBeenCalledWith(
        'user-id',
        'current',
        expect.objectContaining({ limit: 20 })
      );
    });

    it('should throw on invalid cursor', async () => {
      mockCursorService.decode.mockImplementation(() => {
        throw new Error('invalid cursor');
      });

      await expect(
        service.list('user-id', currentSession, 20, '!!!invalid!!!')
      ).rejects.toThrow();
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

      mockSessionRepository.listUserSessions.mockResolvedValue(sessions);

      const result = await service.list('user-id', currentSession, 20);

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toEqual(expect.any(String));
    });
  });
});
