import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import {
  IUserRepository,
  IUserQueryService,
  USER_REPOSITORY
} from '../../interfaces/users.interface';

@Injectable()
export class UserQueryService implements IUserQueryService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findUserById(id);
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    return this.userRepository.findByEmailOrUsernameForAuth(identifier);
  }

  async findForTokenValidation(id: string): Promise<User | null> {
    return this.userRepository.findUserForTokenValidation(id);
  }
}
