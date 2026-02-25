import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn()
    } as any;

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repo)
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DataSource, useValue: dataSource }]
    }).compile();

    service = module.get(UsersService);
  });

  // ----------------- findById -----------------
  it('findById should return user if exists', async () => {
    const fakeUser: Partial<User> = {
      id: '550e8400-e29b-41d4-a716-446655440000'
    };
    repo.findOne.mockResolvedValue(fakeUser as User);

    const result = await service.findById(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result).toEqual(fakeUser);
  });

  it('findById should throw NotFoundException if user not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.findById('550e8400-e29b-41d4-a716-446655440000')
    ).rejects.toThrow(NotFoundException);
  });

  // ----------------- findByIdentifierForAuth -----------------
  it('findByIdentifierForAuth should return user if found', async () => {
    const fakeUser: Partial<User> = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      username: 'test',
      email: 'test@example.com',
      password: 'pass',
      status: UserStatus.ACTIVATE
    };
    repo.findOne.mockResolvedValue(fakeUser as User);

    const result = await service.findByIdentifierForAuth(fakeUser.email!);
    expect(result).toEqual(fakeUser);
  });

  it('findByIdentifierForAuth should return null if not found', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.findByIdentifierForAuth('test@example.com');
    expect(result).toBeNull();
  });

  // ----------------- register -----------------
  it('register should create and save user successfully', async () => {
    const dto: CreateUserDto = {
      email: 'a@test.com',
      username: 'user1',
      password: 'password'
    };
    repo.create.mockReturnValue(dto as any);
    repo.save.mockResolvedValue({} as any);

    await expect(service.register(dto)).resolves.toBeUndefined();
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(repo.save).toHaveBeenCalled();
  });

  it('register should throw UnprocessableEntityException if email exists', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockRejectedValue({
      code: '23505',
      detail: 'Key (email) already exists'
    });

    await expect(service.register({} as any)).rejects.toThrow(
      'email already exists'
    );
  });

  it('register should throw UnprocessableEntityException if username exists', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockRejectedValue({
      code: '23505',
      detail: 'Key (username) already exists'
    });

    await expect(service.register({} as any)).rejects.toThrow(
      'username already exists'
    );
  });

  // ----------------- updateProfile -----------------
  it('updateProfile should update successfully', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    repo.findOne.mockResolvedValue({ id: userId } as User);
    repo.update.mockResolvedValue({} as any);

    await expect(
      service.updateProfile(userId, { name: 'Updated' } as UpdateUserDto)
    ).resolves.toBeUndefined();
    expect(repo.update).toHaveBeenCalledWith(
      { id: userId },
      { name: 'Updated' }
    );
  });

  it('updateProfile should throw if user does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        {} as UpdateUserDto
      )
    ).rejects.toThrow(NotFoundException);
  });

  // ----------------- setPassword -----------------
  it('setPassword should call update with hashed password', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const hashPassword = 'hashed123';

    await service.setPassword(userId, hashPassword);
    expect(repo.update).toHaveBeenCalledWith(
      { id: userId },
      { password: hashPassword }
    );
  });

  // ----------------- list -----------------
  it('list should return array of users', async () => {
    const users: Partial<User>[] = [
      { id: '550e8400-e29b-41d4-a716-446655440000' },
      { id: '550e8400-e29b-41d4-a716-446655442200' }
    ];
    repo.find.mockResolvedValue(users as User[]);

    const result = await service.list();
    expect(result).toEqual(users);
  });

  // ----------------- requestAccountDeletion -----------------
  it('requestAccountDeletion should soft delete user', async () => {
    const fakeUser: Partial<User> = {
      id: '550e8400-e29b-41d4-a716-446655440000'
    };
    repo.findOne.mockResolvedValue(fakeUser as User);
    repo.softRemove.mockResolvedValue({} as any);

    await service.requestAccountDeletion(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(repo.softRemove).toHaveBeenCalledWith(fakeUser);
  });
});
