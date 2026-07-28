import { Session } from '../../../domain/entities/session.entity';
import { SessionRotationUseCase } from '../../use-cases/session-rotation.use-case';

describe('SessionRotationUseCase', () => {
  const mockSessionRepository = {
    rotateRefreshToken: jest.fn(),
    saveRefreshTokenHash: jest.fn()
  };

  const service = new SessionRotationUseCase(mockSessionRepository as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delegate to repository rotateRefreshToken', async () => {
      mockSessionRepository.rotateRefreshToken.mockResolvedValue(true);

      const result = await service.execute(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        { now: Date.now(), expiresAt: new Date() }
      );

      expect(mockSessionRepository.rotateRefreshToken).toHaveBeenCalledWith(
        'session-id',
        1,
        'old-hash',
        'new-hash',
        expect.anything()
      );
      expect(result).toBe(true);
    });
  });

  describe('saveHash', () => {
    it('should delegate to repository saveRefreshTokenHash', async () => {
      const session = { id: 'session-id' } as Session;
      mockSessionRepository.saveRefreshTokenHash.mockResolvedValue(session);

      const result = await service.saveHash(session);

      expect(mockSessionRepository.saveRefreshTokenHash).toHaveBeenCalledWith(
        session
      );
      expect(result).toBe(session);
    });
  });
});
