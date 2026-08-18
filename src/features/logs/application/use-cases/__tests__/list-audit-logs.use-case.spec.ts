import { ListAuditLogsUseCase } from '../list-audit-logs.use-case';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../../domain/enums/audit.enum';
import { LogMapper } from '../../mappers/log.mapper';

// Mock the LogMapper static methods
jest.mock('../../mappers/log.mapper');

describe('ListAuditLogsUseCase', () => {
  const auditLogRepository = {
    findLogs: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  let useCase: ListAuditLogsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    (LogMapper.decodeAuditCursor as jest.Mock).mockReturnValue(undefined);
    (LogMapper.encodeAuditCursor as jest.Mock).mockReturnValue('next-cursor');
    (LogMapper.toAuditLogItem as jest.Mock).mockImplementation((log) => ({
      id: log._id?.toString() || log.id,
      timestamp: log.timestamp,
      actorType: log.actorType,
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      success: log.success,
      createdAt: log.createdAt
    }));

    useCase = new ListAuditLogsUseCase(
      auditLogRepository as any,
      logger as any
    );
  });

  it('should apply default pagination and return results', async () => {
    const mockLogs = [
      { _id: 'log-1', timestamp: new Date(), action: 'USER_LOGIN' },
      { _id: 'log-2', timestamp: new Date(), action: 'USER_LOGOUT' }
    ];

    auditLogRepository.findLogs.mockResolvedValue(mockLogs);

    const result = await useCase.execute({});

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith({
      limit: 51, // 50 + 1 for detecting next page
      cursor: undefined,
      userId: undefined,
      action: undefined,
      resourceType: undefined,
      resourceId: undefined,
      actorType: undefined,
      success: undefined,
      requestId: undefined,
      startDate: undefined,
      endDate: undefined
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('should apply cursor pagination', async () => {
    const decodedCursor = { timestamp: new Date(), id: 'log-123' };
    (LogMapper.decodeAuditCursor as jest.Mock).mockReturnValue(decodedCursor);
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ cursor: 'encoded-cursor', limit: 25 });

    expect(LogMapper.decodeAuditCursor).toHaveBeenCalledWith('encoded-cursor');
    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 26,
        cursor: decodedCursor
      })
    );
  });

  it('should apply userId filter', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ userId: 'user-123' });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123'
      })
    );
  });

  it('should apply action filter', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ action: AuditAction.USER_LOGIN });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.USER_LOGIN
      })
    );
  });

  it('should apply resourceType and resourceId filters', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({
      resourceType: ResourceType.PORTFOLIO,
      resourceId: 'portfolio-456'
    });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: ResourceType.PORTFOLIO,
        resourceId: 'portfolio-456'
      })
    );
  });

  it('should apply actorType filter', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ actorType: ActorType.USER });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: ActorType.USER
      })
    );
  });

  it('should apply success filter', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ success: false });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false
      })
    );
  });

  it('should apply requestId filter', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ requestId: 'req-789' });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-789'
      })
    );
  });

  it('should apply date filters', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z'
    });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-12-31T23:59:59Z')
      })
    );
  });

  it('should enforce maximum limit', async () => {
    auditLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ limit: 500 });

    expect(auditLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101 // MAX_LIMIT (100) + 1
      })
    );
  });

  it('should propagate repository errors', async () => {
    const error = new Error('Database connection failed');
    auditLogRepository.findLogs.mockRejectedValue(error);

    await expect(useCase.execute({})).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('should map all returned logs to response DTOs', async () => {
    const mockLogs = [
      { _id: 'log-1', action: 'USER_LOGIN' },
      { _id: 'log-2', action: 'PORTFOLIO_CREATED' },
      { _id: 'log-3', action: 'HOLDING_UPDATED' }
    ];
    auditLogRepository.findLogs.mockResolvedValue(mockLogs);

    const result = await useCase.execute({});

    expect(LogMapper.toAuditLogItem).toHaveBeenCalledTimes(3);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe('log-1');
    expect(result.items[2].id).toBe('log-3');
  });
});
