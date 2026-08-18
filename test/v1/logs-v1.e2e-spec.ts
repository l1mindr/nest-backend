import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { getMongoConnection } from '../helpers/mongodb.helper';
import { ApiClient } from '../helpers/api-client.helper';
import {
  AuditAction,
  ResourceType,
  ActorType
} from '@features/logs/domain/enums/audit.enum';
import {
  SystemLogLevel,
  SystemLogEvent
} from '@features/logs/domain/enums/system.enum';

describe('Logs API (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let mongoConnection: any;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
    mongoConnection = await getMongoConnection(app);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    // Clear MongoDB collections
    await mongoConnection.collection('auditlogs').deleteMany({});
    await mongoConnection.collection('systemlogs').deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /v1/logs/audit', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const client = new ApiClient(app);
      const response = await client.get('/v1/logs/audit');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-OWNER users', async () => {
      const userContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.USER },
        dataSource
      );

      const response = await userContext.client.get('/v1/logs/audit');
      expect(response.status).toBe(403);
    });

    it('should return 403 for ADMIN users', async () => {
      const adminContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.ADMIN },
        dataSource
      );

      const response = await adminContext.client.get('/v1/logs/audit');
      expect(response.status).toBe(403);
    });

    it('should return 200 with empty results for OWNER', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await ownerContext.client.get('/v1/logs/audit');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [],
        nextCursor: null
      });
    });

    it('should return paginated audit logs for OWNER', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      // Insert test audit logs
      const now = new Date();
      await mongoConnection.collection('auditlogs').insertMany([
        {
          timestamp: new Date(now.getTime() - 3000),
          actorType: ActorType.USER,
          userId: 'user-1',
          action: AuditAction.USER_LOGIN,
          resourceType: ResourceType.USER,
          resourceId: 'user-1',
          success: true,
          ipAddress: '127.0.0.1',
          createdAt: new Date(now.getTime() - 3000)
        },
        {
          timestamp: new Date(now.getTime() - 2000),
          actorType: ActorType.USER,
          userId: 'user-2',
          action: AuditAction.PORTFOLIO_CREATED,
          resourceType: ResourceType.PORTFOLIO,
          resourceId: 'portfolio-1',
          success: true,
          ipAddress: '127.0.0.1',
          createdAt: new Date(now.getTime() - 2000)
        },
        {
          timestamp: new Date(now.getTime() - 1000),
          actorType: ActorType.USER,
          userId: 'user-1',
          action: AuditAction.USER_LOGOUT,
          resourceType: ResourceType.USER,
          resourceId: 'user-1',
          success: true,
          ipAddress: '127.0.0.1',
          createdAt: new Date(now.getTime() - 1000)
        }
      ]);

      const response = await ownerContext.client.get('/v1/logs/audit');
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.nextCursor).toBeNull();

      // Verify newest first (timestamp DESC)
      expect(response.body.items[0].action).toBe(AuditAction.USER_LOGOUT);
      expect(response.body.items[1].action).toBe(AuditAction.PORTFOLIO_CREATED);
      expect(response.body.items[2].action).toBe(AuditAction.USER_LOGIN);
    });

    it('should filter by userId', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      await mongoConnection.collection('auditlogs').insertMany([
        {
          timestamp: new Date(),
          actorType: ActorType.USER,
          userId: 'user-1',
          action: AuditAction.USER_LOGIN,
          resourceType: ResourceType.USER,
          resourceId: 'user-1',
          success: true,
          createdAt: new Date()
        },
        {
          timestamp: new Date(),
          actorType: ActorType.USER,
          userId: 'user-2',
          action: AuditAction.USER_LOGIN,
          resourceType: ResourceType.USER,
          resourceId: 'user-2',
          success: true,
          createdAt: new Date()
        }
      ]);

      const response = await ownerContext.client.get(
        '/v1/logs/audit?userId=user-1'
      );
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].userId).toBe('user-1');
    });

    it('should filter by action', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      await mongoConnection.collection('auditlogs').insertMany([
        {
          timestamp: new Date(),
          actorType: ActorType.USER,
          userId: 'user-1',
          action: AuditAction.USER_LOGIN,
          resourceType: ResourceType.USER,
          resourceId: 'user-1',
          success: true,
          createdAt: new Date()
        },
        {
          timestamp: new Date(),
          actorType: ActorType.USER,
          userId: 'user-1',
          action: AuditAction.PORTFOLIO_CREATED,
          resourceType: ResourceType.PORTFOLIO,
          resourceId: 'portfolio-1',
          success: true,
          createdAt: new Date()
        }
      ]);

      const response = await ownerContext.client.get(
        `/v1/logs/audit?action=${AuditAction.PORTFOLIO_CREATED}`
      );
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].action).toBe(AuditAction.PORTFOLIO_CREATED);
    });

    it('should return 400 for invalid query parameters', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await ownerContext.client.get(
        '/v1/logs/audit?limit=abc'
      );
      expect(response.status).toBe(400);
    });

    it('should paginate with cursor', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      // Insert enough logs to trigger pagination
      const logs = Array.from({ length: 55 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 1000),
        actorType: ActorType.USER,
        userId: `user-${i}`,
        action: AuditAction.USER_LOGIN,
        resourceType: ResourceType.USER,
        resourceId: `user-${i}`,
        success: true,
        createdAt: new Date(Date.now() - i * 1000)
      }));
      await mongoConnection.collection('auditlogs').insertMany(logs);

      // First page
      const firstResponse = await ownerContext.client.get(
        '/v1/logs/audit?limit=20'
      );
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.items).toHaveLength(20);
      expect(firstResponse.body.nextCursor).toBeTruthy();

      // Second page using cursor
      const secondResponse = await ownerContext.client.get(
        `/v1/logs/audit?limit=20&cursor=${firstResponse.body.nextCursor}`
      );
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.items).toHaveLength(20);
      expect(secondResponse.body.nextCursor).toBeTruthy();
    });
  });

  describe('GET /v1/logs/system', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const client = new ApiClient(app);
      const response = await client.get('/v1/logs/system');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-OWNER users', async () => {
      const userContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.USER },
        dataSource
      );

      const response = await userContext.client.get('/v1/logs/system');
      expect(response.status).toBe(403);
    });

    it('should return 403 for ADMIN users', async () => {
      const adminContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.ADMIN },
        dataSource
      );

      const response = await adminContext.client.get('/v1/logs/system');
      expect(response.status).toBe(403);
    });

    it('should return 200 with empty results for OWNER', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await ownerContext.client.get('/v1/logs/system');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [],
        nextCursor: null
      });
    });

    it('should return paginated system logs for OWNER', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      // Insert test system logs
      const now = new Date();
      await mongoConnection.collection('systemlogs').insertMany([
        {
          timestamp: new Date(now.getTime() - 3000),
          level: SystemLogLevel.ERROR,
          event: SystemLogEvent.DATABASE_ERROR,
          message: 'Connection failed',
          context: 'DatabaseService',
          createdAt: new Date(now.getTime() - 3000)
        },
        {
          timestamp: new Date(now.getTime() - 2000),
          level: SystemLogLevel.WARNING,
          event: SystemLogEvent.PERFORMANCE_WARNING,
          message: 'Slow query detected',
          context: 'QueryService',
          createdAt: new Date(now.getTime() - 2000)
        },
        {
          timestamp: new Date(now.getTime() - 1000),
          level: SystemLogLevel.INFO,
          event: SystemLogEvent.APPLICATION_STARTED,
          message: 'Application initialized',
          context: 'Bootstrap',
          createdAt: new Date(now.getTime() - 1000)
        }
      ]);

      const response = await ownerContext.client.get('/v1/logs/system');
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.nextCursor).toBeNull();

      // Verify newest first (timestamp DESC)
      expect(response.body.items[0].event).toBe(
        SystemLogEvent.APPLICATION_STARTED
      );
      expect(response.body.items[1].event).toBe(
        SystemLogEvent.PERFORMANCE_WARNING
      );
      expect(response.body.items[2].event).toBe(SystemLogEvent.DATABASE_ERROR);
    });

    it('should filter by level', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      await mongoConnection.collection('systemlogs').insertMany([
        {
          timestamp: new Date(),
          level: SystemLogLevel.ERROR,
          event: SystemLogEvent.DATABASE_ERROR,
          message: 'Error occurred',
          context: 'Service',
          createdAt: new Date()
        },
        {
          timestamp: new Date(),
          level: SystemLogLevel.INFO,
          event: SystemLogEvent.APPLICATION_STARTED,
          message: 'Info message',
          context: 'Service',
          createdAt: new Date()
        }
      ]);

      const response = await ownerContext.client.get(
        `/v1/logs/system?level=${SystemLogLevel.ERROR}`
      );
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].level).toBe(SystemLogLevel.ERROR);
    });

    it('should filter by event', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      await mongoConnection.collection('systemlogs').insertMany([
        {
          timestamp: new Date(),
          level: SystemLogLevel.ERROR,
          event: SystemLogEvent.DATABASE_ERROR,
          message: 'DB error',
          context: 'Service',
          createdAt: new Date()
        },
        {
          timestamp: new Date(),
          level: SystemLogLevel.WARNING,
          event: SystemLogEvent.PERFORMANCE_WARNING,
          message: 'Slow query',
          context: 'Service',
          createdAt: new Date()
        }
      ]);

      const response = await ownerContext.client.get(
        `/v1/logs/system?event=${SystemLogEvent.DATABASE_ERROR}`
      );
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].event).toBe(SystemLogEvent.DATABASE_ERROR);
    });

    it('should return 400 for invalid query parameters', async () => {
      const ownerContext = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await ownerContext.client.get(
        '/v1/logs/system?limit=abc'
      );
      expect(response.status).toBe(400);
    });
  });
});
