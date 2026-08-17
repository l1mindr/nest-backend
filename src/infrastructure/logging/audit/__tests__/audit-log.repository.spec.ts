import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogRepository } from '../audit-log.repository';
import { AuditLog } from '../audit-log.schema';
import { MONGODB_CONNECTION_NAME } from '../../mongodb/mongodb.constants';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '../../mongodb/mongodb.constants';
import { CreateAuditLogInput } from '../audit-log.interface';

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;
  let model: Model<AuditLog>;

  const mockAuditLogModel = {
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
        AuditLogRepository,
        {
          provide: getModelToken(AuditLog.name, MONGODB_CONNECTION_NAME),
          useValue: mockAuditLogModel
        }
      ]
    }).compile();

    repository = module.get<AuditLogRepository>(AuditLogRepository);
    model = module.get<Model<AuditLog>>(
      getModelToken(AuditLog.name, MONGODB_CONNECTION_NAME)
    );
  });

  describe('create', () => {
    it('should create audit log with sanitized metadata', async () => {
      const input: CreateAuditLogInput = {
        userId: 'user-123',
        actorType: ActorType.USER,
        action: AuditAction.USER_LOGIN,
        resourceType: ResourceType.SESSION,
        resourceId: 'session-456',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-789',
        metadata: {
          browser: 'Chrome',
          password: 'should-be-redacted'
        }
      };

      const saveMock = jest.fn().mockResolvedValue(undefined);
      const mockInstance = {
        save: saveMock,
        timestamp: expect.any(Date),
        userId: input.userId,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        success: input.success,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: {
          browser: 'Chrome',
          password: '[REDACTED]'
        },
        createdAt: expect.any(Date)
      };

      // Mock the model constructor
      (model as any) = jest.fn().mockReturnValue(mockInstance);
      repository = new AuditLogRepository(model);

      await repository.create(input);

      expect(model).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });

    it('should not throw when MongoDB save fails', async () => {
      const input: CreateAuditLogInput = {
        actorType: ActorType.SYSTEM,
        action: AuditAction.USER_REGISTER,
        success: true
      };

      const saveMock = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB connection failed'));
      const mockInstance = { save: saveMock };

      (model as any) = jest.fn().mockReturnValue(mockInstance);
      repository = new AuditLogRepository(model);

      // Should not throw
      await expect(repository.create(input)).resolves.not.toThrow();
    });
  });

  describe('findByUserId', () => {
    it('should find audit logs by userId with default pagination', async () => {
      const userId = 'user-123';
      const mockLogs = [
        { _id: '1', userId, action: AuditAction.USER_LOGIN },
        { _id: '2', userId, action: AuditAction.USER_LOGOUT }
      ];

      const execMock = jest.fn().mockResolvedValue(mockLogs);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockAuditLogModel.find = findMock;

      const result = await repository.findByUserId(userId);

      expect(findMock).toHaveBeenCalledWith({ userId });
      expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
      expect(skipMock).toHaveBeenCalledWith(0);
      expect(limitMock).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockLogs);
    });

    it('should find audit logs with custom pagination', async () => {
      const userId = 'user-123';

      const execMock = jest.fn().mockResolvedValue([]);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockAuditLogModel.find = findMock;

      await repository.findByUserId(userId, { limit: 10, skip: 20 });

      expect(skipMock).toHaveBeenCalledWith(20);
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  describe('findByRequestId', () => {
    it('should find audit logs by requestId sorted by timestamp', async () => {
      const requestId = 'req-789';
      const mockLogs = [
        { _id: '1', requestId, action: AuditAction.USER_LOGIN },
        { _id: '2', requestId, action: AuditAction.PORTFOLIO_CREATED }
      ];

      const execMock = jest.fn().mockResolvedValue(mockLogs);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
      const findMock = jest.fn().mockReturnValue({ sort: sortMock });

      mockAuditLogModel.find = findMock;

      const result = await repository.findByRequestId(requestId);

      expect(findMock).toHaveBeenCalledWith({ requestId });
      expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 });
      expect(result).toEqual(mockLogs);
    });
  });
});
