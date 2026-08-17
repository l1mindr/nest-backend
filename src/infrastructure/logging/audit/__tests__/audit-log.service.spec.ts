import { AuditLogService } from '../audit-log.service';
import { AuditLogRepository } from '../audit-log.repository';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../mongodb/mongodb.constants';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const mockRepository = {
    create: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService(
      mockRepository as unknown as AuditLogRepository
    );
  });

  describe('record', () => {
    it('should call repository.create with all provided fields', async () => {
      service.record({
        action: AuditAction.USER_LOGIN,
        actorType: ActorType.USER,
        userId: 'user-123',
        resourceType: ResourceType.SESSION,
        resourceId: 'session-456',
        success: true,
        context: {
          requestId: 'req-789',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120'
        },
        metadata: { browser: 'Chrome' }
      });

      // flush microtasks so the void promise resolves
      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN,
          actorType: ActorType.USER,
          userId: 'user-123',
          resourceType: ResourceType.SESSION,
          resourceId: 'session-456',
          success: true,
          requestId: 'req-789',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120',
          metadata: { browser: 'Chrome' }
        })
      );
    });

    it('should record a successful action', async () => {
      service.record({
        action: AuditAction.PORTFOLIO_CREATED,
        actorType: ActorType.USER,
        userId: 'user-1',
        resourceType: ResourceType.PORTFOLIO,
        resourceId: 'portfolio-1',
        success: true
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PORTFOLIO_CREATED,
          success: true,
          userId: 'user-1',
          resourceId: 'portfolio-1'
        })
      );
    });

    it('should record a failed action', async () => {
      service.record({
        action: AuditAction.USER_LOGIN,
        actorType: ActorType.ANONYMOUS,
        success: false,
        context: { ipAddress: '10.0.0.1' }
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN,
          actorType: ActorType.ANONYMOUS,
          success: false,
          ipAddress: '10.0.0.1'
        })
      );
    });

    it('should not throw when repository.create rejects', async () => {
      mockRepository.create.mockRejectedValueOnce(
        new Error('MongoDB unavailable')
      );

      // Must not throw or reject
      expect(() =>
        service.record({
          action: AuditAction.USER_LOGIN,
          actorType: ActorType.USER,
          userId: 'user-1',
          success: true
        })
      ).not.toThrow();

      await new Promise(setImmediate);

      // Repository was called despite later rejection
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should propagate undefined requestId when context has no requestId', async () => {
      service.record({
        action: AuditAction.USER_REGISTER,
        actorType: ActorType.ANONYMOUS,
        userId: 'user-1',
        success: true,
        context: {}
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
          ipAddress: undefined,
          userAgent: undefined
        })
      );
    });

    it('should pass metadata through to repository', async () => {
      service.record({
        action: AuditAction.ACCOUNT_UPDATE,
        actorType: ActorType.USER,
        userId: 'user-1',
        success: true,
        metadata: { changedFields: ['email'], reason: 'user request' }
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { changedFields: ['email'], reason: 'user request' }
        })
      );
    });
  });
});
