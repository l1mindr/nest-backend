import { User } from '@features/users/entities/user.entity';
import { InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { IDevice } from './interfaces/device.interface';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: jest.Mocked<Repository<Session>>;
  let mockDataSource: any;
  let mockJwtService: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn()
    } as any;

    mockJwtService = {
      sign: jest.fn().mockReturnValue('jwt-token')
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(repo),
      transaction: jest.fn().mockImplementation(async (cb) => {
        const mockManager = {
          getRepository: jest.fn().mockReturnValue(repo)
        };
        return cb(mockManager);
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService }
      ]
    }).compile();

    service = module.get(SessionsService);
  });

  it('should issue session and return token', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue({} as any);

    const token = await service.issue('user-id', 'ip', {
      name: 'safari',
      version: '26.3'
    } as IDevice);

    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-id',
        jti: expect.any(String)
      })
    );
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(token).toBe('jwt-token');
  });

  it('should throw if saving session fails', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockRejectedValue(new Error());

    await expect(service.issue('user-id', 'ip', {} as any)).rejects.toThrow(
      InternalServerErrorException
    );
  });

  it('should return active session', async () => {
    const fakeSession = { token: 'jwt-token' };

    repo.findOne.mockResolvedValue(fakeSession as any);

    const res = await service.getActive('user-id', 'jwt-token');
    expect(repo.findOne).toHaveBeenCalled();
    expect(res).toEqual(fakeSession);
  });

  it('should return current session + other sessions', async () => {
    const otherSessions = [
      {
        ip: '2.2.2.2',
        expiryDate: new Date(),
        device: { name: 'safari', version: '26.3' }
      }
    ];

    repo.find.mockResolvedValue(otherSessions as any);

    const res = await service.list({
      user: { id: 'user-id' },
      session: {
        token: 'abc',
        ip: '1.1.1.1',
        expiryDate: new Date(),
        device: {}
      }
    } as any);

    expect(repo.find).toHaveBeenCalled();
    expect(res.length).toBe(2);
    expect(res[0].current).toBe(true);
  });

  it('should delete specific session', async () => {
    await service.revoke({ id: 'user-id' } as User, 'jwt-token');

    expect(repo.delete).toHaveBeenCalledWith({
      owner: { id: 'user-id' },
      token: 'jwt-token'
    });
  });

  it('should delete all other sessions', async () => {
    await service.terminateOthers({ id: 'user-id' } as User, 'jwt-token');
    expect(repo.delete).toHaveBeenCalledWith({
      owner: { id: 'user-id' },
      token: expect.any(Object)
    });
  });
});
