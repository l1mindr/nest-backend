import { SystemLogService } from '../system-log.service';
import { SystemLogRepository } from '../system-log.repository';
import {
  SystemLogEvent,
  SystemLogLevel
} from '../../mongodb/mongodb.constants';

describe('SystemLogService', () => {
  let service: SystemLogService;

  const mockRepository = {
    create: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SystemLogService(
      mockRepository as unknown as SystemLogRepository
    );
  });

  describe('error', () => {
    it('should call repository.create with ERROR level', async () => {
      service.error(SystemLogEvent.APPLICATION_ERROR, 'Something failed', {
        context: 'SomeService',
        requestId: 'req-123',
        userId: 'user-1',
        durationMs: 500,
        metadata: { operation: 'fetchData' }
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: SystemLogLevel.ERROR,
          event: SystemLogEvent.APPLICATION_ERROR,
          message: 'Something failed',
          context: 'SomeService',
          requestId: 'req-123',
          userId: 'user-1',
          durationMs: 500,
          metadata: { operation: 'fetchData' }
        })
      );
    });

    it('should extract Error object properties', async () => {
      const err = new Error('DB timeout');
      err.name = 'DatabaseError';

      service.error(SystemLogEvent.DATABASE_ERROR, 'Database query failed', {
        error: err
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'DatabaseError',
            message: 'DB timeout',
            stack: expect.any(String)
          })
        })
      );
    });

    it('should handle non-Error thrown values', async () => {
      service.error(SystemLogEvent.UNHANDLED_EXCEPTION, 'String thrown', {
        error: 'just a string'
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          error: { name: 'UnknownError', message: 'just a string' }
        })
      );
    });

    it('should not throw when repository rejects', async () => {
      mockRepository.create.mockRejectedValueOnce(
        new Error('MongoDB unavailable')
      );

      expect(() =>
        service.error(SystemLogEvent.APPLICATION_ERROR, 'Failed')
      ).not.toThrow();

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should call repository.create with WARNING level', async () => {
      service.warn(SystemLogEvent.RATE_LIMIT_EXCEEDED, 'Rate limit hit', {
        requestId: 'req-abc',
        metadata: { limit: 100 }
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: SystemLogLevel.WARNING,
          event: SystemLogEvent.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit hit',
          requestId: 'req-abc'
        })
      );
    });
  });

  describe('info', () => {
    it('should call repository.create with INFO level and no error field', async () => {
      service.info(SystemLogEvent.ASSET_SYNC_COMPLETED, 'Sync finished', {
        durationMs: 1200,
        metadata: { count: 50 }
      });

      await new Promise(setImmediate);

      const call = mockRepository.create.mock.calls[0][0];
      expect(call.level).toBe(SystemLogLevel.INFO);
      expect(call.event).toBe(SystemLogEvent.ASSET_SYNC_COMPLETED);
      expect(call.durationMs).toBe(1200);
      // info() does not pass error field
      expect(call.error).toBeUndefined();
    });
  });

  describe('correlation ID propagation', () => {
    it('should propagate requestId from opts', async () => {
      service.error(SystemLogEvent.EXTERNAL_API_ERROR, 'API failed', {
        requestId: 'correlation-xyz'
      });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'correlation-xyz' })
      );
    });

    it('should leave requestId undefined when not provided', async () => {
      service.error(SystemLogEvent.QUEUE_JOB_FAILED, 'Job failed');

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: undefined })
      );
    });
  });

  describe('metadata sanitization', () => {
    it('should pass metadata to the repository (sanitization occurs inside repository)', async () => {
      // SystemLogService forwards metadata as-is to the repository.
      // The repository's create() method calls sanitizeMetadata internally
      // before writing to MongoDB. The service layer does not duplicate that
      // logic, keeping the responsibility in one place.
      const metadata = {
        userId: 'user-1',
        operation: 'safe-value',
        durationMs: 42
      };

      service.error(SystemLogEvent.APPLICATION_ERROR, 'Err', { metadata });

      await new Promise(setImmediate);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata })
      );
    });
  });
});
