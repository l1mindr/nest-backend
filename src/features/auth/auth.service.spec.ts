import { Session } from '@features/sessions/entities/session.entity';
import { IDevice } from '@features/sessions/interfaces/device.interface';
import { ISessionsService } from '@features/sessions/interfaces/sessions.interface';
import { User } from '@features/users/entities/user.entity';
import { IUsersService } from '@features/users/interfaces/users.interface';
import { SESSIONS_SERVICE, USERS_SERVICE } from '@infrastructure/di/tokens';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { HashingProvider } from './providers/hashing.provider';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: jest.Mocked<IUsersService>;
  let mockSessionsService: jest.Mocked<ISessionsService>;
  let mockHashingProvider: jest.Mocked<HashingProvider>;

  beforeEach(async () => {
    mockUsersService = {
      findByIdentifierForAuth: jest.fn(),
      findByIdWithPassword: jest.fn(),
      setPassword: jest.fn(),
      findByIdForSessionValidation: jest.fn(),
      register: jest.fn(),
      list: jest.fn(),
      updateProfile: jest.fn(),
      requestAccountDeletion: jest.fn()
    };

    mockSessionsService = {
      issue: jest.fn(),
      getActive: jest.fn(),
      list: jest.fn(),
      revoke: jest.fn(),
      terminateOthers: jest.fn()
    };

    mockHashingProvider = {
      hash: jest.fn(),
      compare: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USERS_SERVICE,
          useValue: mockUsersService
        },
        {
          provide: SESSIONS_SERVICE,
          useValue: mockSessionsService
        },
        { provide: HashingProvider, useValue: mockHashingProvider }
      ]
    }).compile();

    service = module.get(AuthService);
  });

  it('should hash password and register user', async () => {
    const dto: RegisterUserDto = {
      email: 'a@test.com',
      username: 'user1',
      password: 'password'
    };

    mockHashingProvider.hash.mockResolvedValue('hashed-password');
    mockUsersService.register.mockResolvedValue(undefined);

    await service.registerUser(dto);

    await expect(mockUsersService.register(dto)).resolves.toBeUndefined();
    expect(mockUsersService.register).toHaveBeenCalledWith(dto);

    expect(mockHashingProvider.hash).toHaveBeenCalledWith('password');
    expect(mockUsersService.register).toHaveBeenCalledWith({
      ...dto,
      password: 'hashed-password'
    });
  });

  it('should throw if user not found', async () => {
    mockUsersService.findByIdentifierForAuth.mockResolvedValue(null);

    await expect(
      service.loginUser({ email: 'a@test.com', password: 'password' }, 'ip', {
        name: 'safari',
        version: '26.3'
      } as IDevice)
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if password invalid', async () => {
    mockUsersService.findByIdentifierForAuth.mockResolvedValue({
      email: 'a@test.com',
      password: 'hash-password'
    } as User);

    mockHashingProvider.compare.mockResolvedValue(false);

    await expect(
      service.loginUser({ email: 'a@test.com', password: 'password' }, 'ip', {
        name: 'safari',
        version: '26.3'
      } as IDevice)
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return token when credentials are valid', async () => {
    mockUsersService.findByIdentifierForAuth.mockResolvedValue({
      id: 'user-id',
      password: 'hash-password'
    } as User);

    mockHashingProvider.compare.mockResolvedValue(true);
    mockSessionsService.issue.mockResolvedValue('token-123');

    const res = await service.loginUser(
      { email: 'a@test.com', password: 'password' },
      'ip',
      {
        name: 'safari',
        version: '26.3'
      } as IDevice
    );

    expect(mockSessionsService.issue).toHaveBeenCalledWith('user-id', 'ip', {
      name: 'safari',
      version: '26.3'
    } as IDevice);
    expect(res).toBe('token-123');
  });

  it('should throw if user not found', async () => {
    mockUsersService.findByIdWithPassword.mockResolvedValue(null);

    await expect(
      service.changeUserPassword(
        {
          user: { id: 'user-id' },
          session: { token: 'jwt-token' }
        } as CustomAuth,
        { currentPassword: 'password', newPassword: 'new-password' }
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if current password invalid', async () => {
    mockUsersService.findByIdWithPassword.mockResolvedValue({
      id: 'user-id',
      password: 'hash-password'
    } as User);

    mockHashingProvider.compare.mockResolvedValue(false);

    await expect(
      service.changeUserPassword(
        {
          user: { id: 'user-id' },
          session: { token: 'jwt-token' }
        } as CustomAuth,
        { currentPassword: 'wrong', newPassword: 'newPassword' }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw if new password same as old', async () => {
    mockUsersService.findByIdWithPassword.mockResolvedValue({
      id: 'user-id',
      password: 'hash-password'
    } as User);

    mockHashingProvider.compare
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changeUserPassword(
        {
          user: { id: 'user-id' },
          session: { token: 'jwt-token' }
        } as CustomAuth,
        { currentPassword: 'hash-password', newPassword: 'hash-password' }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('should change password and terminate other sessions', async () => {
    mockUsersService.findByIdWithPassword.mockResolvedValue({
      id: 'user-id',
      password: 'hash-password'
    } as User);

    mockHashingProvider.compare
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    mockHashingProvider.hash.mockResolvedValue('new-password');

    await service.changeUserPassword(
      {
        user: { id: 'user-id' },
        session: { token: 'jwt-token' }
      } as CustomAuth,
      { currentPassword: 'hash-password', newPassword: 'new-password' }
    );

    expect(mockUsersService.setPassword).toHaveBeenCalledWith(
      'user-id',
      'new-password'
    );
    expect(mockSessionsService.terminateOthers).toHaveBeenCalledWith(
      { id: 'user-id' },
      'jwt-token'
    );
  });

  it('should throw if user not found', async () => {
    mockUsersService.findByIdForSessionValidation.mockResolvedValue(null);
    await expect(
      service.validateUserJwt('user-id', 'jwt-token')
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if session expired', async () => {
    mockUsersService.findByIdForSessionValidation.mockResolvedValue({
      id: 'user-id'
    } as User);

    mockSessionsService.getActive.mockResolvedValue(null);

    await expect(
      service.validateUserJwt('user-id', 'jwt-token')
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return user and session if valid', async () => {
    mockUsersService.findByIdForSessionValidation.mockResolvedValue({
      id: 'user-id'
    } as User);
    mockSessionsService.getActive.mockResolvedValue({
      token: 'jwt-token'
    } as Session);

    const res = await service.validateUserJwt('user-id', 'jwt-token');

    expect(res).toEqual({
      user: { id: 'user-id' },
      session: { token: 'jwt-token' }
    });
  });
});
