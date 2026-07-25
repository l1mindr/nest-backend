import { RevokeSessionService } from './revoke-session.service';

describe('RevokeSessionService', () => {
  let service: RevokeSessionService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockSessionRepository = {
    revokeSession: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RevokeSessionService(
      mockSessionRepository as any,
      mockLogger as any
    );
  });

  describe('revokeSession', () => {
    it('should revoke session', async () => {
      mockSessionRepository.revokeSession.mockResolvedValue(undefined);

      await service.revokeSession('user-id', 'session-id');

      expect(mockSessionRepository.revokeSession).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });
  });
});
