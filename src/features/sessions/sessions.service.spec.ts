import { DataSource } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    query: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new SessionsService(mockDataSource as unknown as DataSource);
  });

  describe('issue', () => {
    it('should create and save session', async () => {
      const session = {
        id: 'session-id'
      } as Session;

      mockRepository.create.mockReturnValue(session);
      mockRepository.save.mockResolvedValue(session);

      const result = await service.issue(
        'user-id',
        '127.0.0.1',
        {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        new Date()
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(session);
      expect(result).toEqual(session);
    });
  });

  describe('getActive', () => {
    it('should return active session', async () => {
      const session = { id: '1' } as Session;

      mockRepository.findOne.mockResolvedValue(session);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toEqual(session);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getActive('user-id', 'session-id');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return current session first', async () => {
      const currentSession = {
        id: 'current'
      } as Session;

      const sessions = [
        {
          id: 'other'
        }
      ];

      mockRepository.find.mockResolvedValue(sessions);

      const result = await service.list('user-id', currentSession);

      expect(result).toEqual([
        {
          ...currentSession,
          current: true
        },
        ...sessions
      ]);
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

  describe('rotateRefreshToken', () => {
    it('should return true when update succeeds', async () => {
      mockRepository.query.mockResolvedValue([{ id: 'session-id' }]);

      const result = await service.rotateRefreshToken(
        'session-id',
        'old-hash',
        'new-hash',
        {
          lastUsedAt: new Date(),
          expiresAt: new Date(),
          rotatedAt: new Date()
        }
      );

      expect(result).toBe(true);

      expect(mockRepository.query).toHaveBeenCalled();
    });

    it('should return false when update affects no rows', async () => {
      mockRepository.query.mockResolvedValue([]);

      const result = await service.rotateRefreshToken(
        'session-id',
        'old-hash',
        'new-hash',
        {
          lastUsedAt: new Date(),
          expiresAt: new Date(),
          rotatedAt: new Date()
        }
      );

      expect(result).toBe(false);
    });
  });
});
