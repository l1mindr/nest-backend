import { Inject, Injectable } from '@nestjs/common';
import { UpdateProfileRequestDto } from '../../presentation/dto/request/update-profile.request.dto';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IUpdateProfileUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../infrastructure/providers/unique-constraint.handler';

@Injectable()
export class UpdateProfileUseCase implements IUpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(userId: string, dto: UpdateProfileRequestDto): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    try {
      await this.userRepository.updateUserProfile(userId, dto);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }
  }
}
