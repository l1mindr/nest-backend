import { Inject, Injectable } from '@nestjs/common';
import { UpdateProfileRequestDto } from '../../dto/request/update-profile.request.dto';
import { UserErrors } from '../../errors/user-errors';
import {
  IUpdateProfileService,
  IUserRepository,
  USER_REPOSITORY
} from '../../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../providers/unique-constraint.handler';

@Injectable()
export class UpdateProfileService implements IUpdateProfileService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async update(userId: string, dto: UpdateProfileRequestDto): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    try {
      await this.userRepository.updateUserProfile(userId, dto);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }
  }
}
