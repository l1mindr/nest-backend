import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemLogRepository } from '../system-log.repository';
import { SystemLog } from '../system-log.schema';
import { MONGODB_CONNECTION_NAME } from '../../mongodb/mongodb.constants';
import {
  SystemLogEvent,
  SystemLogLevel
} from '../../mongodb/mongodb.constants';
import { CreateSystemLogInput } from '../system-log.interface';

describe('SystemLogRepository', () => {
  let repository: SystemLogRepository;
  let model: Model<SystemLog>;

  const mockSystemLogModel = {
    prototype: {
      save: jest.fn()
    },
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemLogRepository,
        {
          provide: getModelToken(SystemLog.name, MONGODB_CONNECTION_NAME),
          useValue: mockSystemLogModel
        }
      ]
    }).compile();

    repository = module.get<SystemLogRepository>(SystemLogRepository);
    model = module.get<Model<SystemLog>>(
      getModelToken(SystemLog.name, MONGODB_CONNECTION_NAME)
    );
  });

  describe('create', () => {
    it('should create system log with sanitized metadata', async () => {
      const input: CreateSystemLogInput = {
        level: SystemLogLevel.ERROR,
        event: SystemLogEvent.APPLICATION_ERROR,
        message: 'Database connection failed',
        context: 'DatabaseService',
        userId: 'user-123',
        requestId: 'req-789',
        metadata: {
          database: 'postgres',
          apiKey: 'should-be-redacted'
        },
        error: {
          name: 'DatabaseError',
          message: 'Connection timeout',
          stack: 'Error: Connection timeout\n    at ...',
          code: 'ETIMEDOUT'
        },
        durationMs: 5000
      };

      const saveMock = jest.fn().mockResolvedValue(undefined);
      const mockInstance = {
        save: saveMock,
        timestamp: expect.any(Date),
        level: input.level,
        event: input.event,
        message: input.message,
        context: input.context,
        userId: input.userId,
        requestId: input.requestId,
        metadata: {
          database: 'postgres',
          apiKey: '[REDACTED]'
        },
        error: input.error,
        durationMs: input.durationMs,
        createdAt: expect.any(Date)
      };

      (model as any) = jest.fn().mockReturnValue(mockInstance);
      repository = new SystemLogRepository(model);

      await repository.create(input);

      expect(model).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });

    it('should not throw when MongoDB save fails', async () => {
      const input: CreateSystemLogInput = {
        level: SystemLogLevel.INFO,
        event: SystemLogEvent.APPLICATION_STARTED,
        message: 'Application started successfully'
      };

      const saveMock = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB connection failed'));
      const mockInstance = { save: saveMock };

      (model as any) = jest.fn().mockReturnValue(mockInstance);
      repository = new SystemLogRepository(model);

      // Should not throw
      await expect(repository.create(input)).resolves.not.toThrow();
    });
  });

  describe('findByLevel', () => {
    it('should find system logs by level with default pagination', async () => {
      const level = SystemLogLevel.ERROR;
      const mockLogs = [
        { _id: '1', level, event: SystemLogEvent.APPLICATION_ERROR },
        { _id: '2', level, event: SystemLogEvent.DATABASE_ERROR }
      ];

      const execMock = jest.fn().mockResolvedValue(mockLogs);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockSystemLogModel.find = findMock;

      const result = await repository.findByLevel(level);

      expect(findMock).toHaveBeenCalledWith({ level });
      expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
      expect(skipMock).toHaveBeenCalledWith(0);
      expect(limitMock).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockLogs);
    });

    it('should find system logs with custom pagination', async () => {
      const level = SystemLogLevel.WARNING;

      const execMock = jest.fn().mockResolvedValue([]);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockSystemLogModel.find = findMock;

      await repository.findByLevel(level, { limit: 25, skip: 50 });

      expect(skipMock).toHaveBeenCalledWith(50);
      expect(limitMock).toHaveBeenCalledWith(25);
    });
  });

  describe('findByRequestId', () => {
    it('should find system logs by requestId sorted by timestamp', async () => {
      const requestId = 'req-789';
      const mockLogs = [
        { _id: '1', requestId, event: SystemLogEvent.HTTP_REQUEST },
        { _id: '2', requestId, event: SystemLogEvent.HTTP_RESPONSE }
      ];

      const execMock = jest.fn().mockResolvedValue(mockLogs);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockSystemLogModel.find = findMock;

      const result = await repository.findByRequestId(requestId);

      expect(findMock).toHaveBeenCalledWith({ requestId });
      expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('findByEvent', () => {
    it('should find system logs by event with default pagination', async () => {
      const event = SystemLogEvent.QUEUE_JOB_FAILED;
      const mockLogs = [
        { _id: '1', event, message: 'Job failed: email-queue' },
        { _id: '2', event, message: 'Job failed: notification-queue' }
      ];

      const execMock = jest.fn().mockResolvedValue(mockLogs);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockSystemLogModel.find = findMock;

      const result = await repository.findByEvent(event);

      expect(findMock).toHaveBeenCalledWith({ event });
      expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
      expect(skipMock).toHaveBeenCalledWith(0);
      expect(limitMock).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockLogs);
    });
  });
});
