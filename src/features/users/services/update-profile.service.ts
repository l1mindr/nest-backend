import { Inject, Injectable } from '@nestjs/common';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { UserErrors } from '../errors/user-errors';
import {
  IUpdateProfileService,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class UpdateProfileService implements IUpdateProfileService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileRequestDto
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    try {
      await this.userRepository.update(userId, dto);
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
