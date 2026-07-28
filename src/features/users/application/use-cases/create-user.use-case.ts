import { Inject, Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from '../../presentation/dto/request/create-user.request.dto';
import {
  ICreateUserUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../infrastructure/providers/unique-constraint.handler';

@Injectable()
export class CreateUserUseCase implements ICreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(dto: CreateUserRequestDto): Promise<void> {
    try {
      await this.userRepository.insertUser(dto);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }
  }
}
