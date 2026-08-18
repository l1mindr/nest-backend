import { ListSystemLogsUseCase } from '../list-system-logs.use-case';
import {
  SystemLogLevel,
  SystemLogEvent
} from '../../../domain/enums/system.enum';
import { LogMapper } from '../../mappers/log.mapper';

// Mock the LogMapper static methods
jest.mock('../../mappers/log.mapper');

describe('ListSystemLogsUseCase', () => {
  const systemLogRepository = {
    findLogs: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  let useCase: ListSystemLogsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    (LogMapper.decodeSystemCursor as jest.Mock).mockReturnValue(undefined);
    (LogMapper.encodeSystemCursor as jest.Mock).mockReturnValue('next-cursor');
    (LogMapper.toSystemLogItem as jest.Mock).mockImplementation((log) => ({
      id: log._id?.toString() || log.id,
      timestamp: log.timestamp,
      level: log.level,
      event: log.event,
      message: log.message,
      context: log.context,
      userId: log.userId,
      requestId: log.requestId,
      createdAt: log.createdAt
    }));

    useCase = new ListSystemLogsUseCase(
      systemLogRepository as any,
      logger as any
    );
  });

  it('should apply default pagination and return results', async () => {
    const mockLogs = [
      { _id: 'log-1', timestamp: new Date(), level: 'ERROR' },
      { _id: 'log-2', timestamp: new Date(), level: 'WARNING' }
    ];

    systemLogRepository.findLogs.mockResolvedValue(mockLogs);

    const result = await useCase.execute({});

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith({
      limit: 51, // 50 + 1 for detecting next page
      cursor: undefined,
      level: undefined,
      event: undefined,
      context: undefined,
      userId: undefined,
      requestId: undefined,
      startDate: undefined,
      endDate: undefined
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('should apply cursor pagination', async () => {
    const decodedCursor = { timestamp: new Date(), id: 'log-123' };
    (LogMapper.decodeSystemCursor as jest.Mock).mockReturnValue(decodedCursor);
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ cursor: 'encoded-cursor', limit: 25 });

    expect(LogMapper.decodeSystemCursor).toHaveBeenCalledWith('encoded-cursor');
    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 26,
        cursor: decodedCursor
      })
    );
  });

  it('should apply level filter', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ level: SystemLogLevel.ERROR });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        level: SystemLogLevel.ERROR
      })
    );
  });

  it('should apply event filter', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ event: SystemLogEvent.DATABASE_ERROR });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        event: SystemLogEvent.DATABASE_ERROR
      })
    );
  });

  it('should apply context filter', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ context: 'AuthService' });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'AuthService'
      })
    );
  });

  it('should apply date filters', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z'
    });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-12-31T23:59:59Z')
      })
    );
  });

  it('should apply requestId filter', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ requestId: 'req-789' });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-789'
      })
    );
  });

  it('should apply userId filter', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ userId: 'user-123' });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123'
      })
    );
  });

  it('should enforce maximum limit', async () => {
    systemLogRepository.findLogs.mockResolvedValue([]);

    await useCase.execute({ limit: 500 });

    expect(systemLogRepository.findLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101 // MAX_LIMIT (100) + 1
      })
    );
  });

  it('should propagate repository errors', async () => {
    const error = new Error('Database connection failed');
    systemLogRepository.findLogs.mockRejectedValue(error);

    await expect(useCase.execute({})).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('should map all returned logs to response DTOs', async () => {
    const mockLogs = [
      { _id: 'log-1', level: 'ERROR', event: 'DATABASE_ERROR' },
      { _id: 'log-2', level: 'WARNING', event: 'PERFORMANCE_WARNING' }
    ];
    systemLogRepository.findLogs.mockResolvedValue(mockLogs);

    const result = await useCase.execute({});

    expect(LogMapper.toSystemLogItem).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('log-1');
    expect(result.items[1].level).toBe('WARNING');
  });
});
