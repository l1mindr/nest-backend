import { Session } from '../../entities/session.entity';
import { SessionQueryService } from './session-query.service';

describe('SessionQueryService', () => {
  const mockSessionRepository = {
    findActiveSession: jest.fn()
  };

  const service = new SessionQueryService(mockSessionRepository as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findActive', () => {
    it('should return active session', async () => {
      const session = { id: 'session-id' } as Session;
      mockSessionRepository.findActiveSession.mockResolvedValue(session);

      const result = await service.findActive('user-id', 'session-id');

      expect(mockSessionRepository.findActiveSession).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
      expect(result).toBe(session);
    });

    it('should return null when session not found', async () => {
      mockSessionRepository.findActiveSession.mockResolvedValue(null);

      const result = await service.findActive('user-id', 'session-id');

      expect(result).toBeNull();
    });
  });
});
