import { Inject, Injectable } from '@nestjs/common';
import { UserErrors } from '../errors/user-errors';
import {
  IFindUserAdminService,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class FindUserAdminService implements IFindUserAdminService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async findById(id: string) {
    const user = await this.userRepository.findByIdForAdmin(id);
    if (!user) throw UserErrors.userNotFound(id);
    return user;
  }
}
