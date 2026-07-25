import { Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from '../dto/request/create-user.request.dto';
import { UserErrors } from '../errors/user-errors';
import {
  ICreateUserService,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class CreateUserService implements ICreateUserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async create(dto: CreateUserRequestDto): Promise<void> {
    try {
      await this.userRepository.create(dto);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
    }
  }

  private handleUniqueConstraintError(error: unknown): never {
    if (isDatabaseError(error) && error.code === '23505') {
      const detail = error.detail ?? '';

      if (detail.includes('email')) throw UserErrors.emailAlreadyExists();

      if (detail.includes('username')) throw UserErrors.usernameAlreadyExists();
    }

    throw error;
  }
}

interface DatabaseError {
  code?: string;
  detail?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}
