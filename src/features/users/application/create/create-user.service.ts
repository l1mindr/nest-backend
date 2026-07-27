import { Inject, Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from '../../dto/request/create-user.request.dto';
import {
  ICreateUserService,
  IUserRepository,
  USER_REPOSITORY
} from '../../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../providers/unique-constraint.handler';

@Injectable()
export class CreateUserService implements ICreateUserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async create(dto: CreateUserRequestDto): Promise<void> {
    try {
      await this.userRepository.insertUser(dto);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }
  }
}
