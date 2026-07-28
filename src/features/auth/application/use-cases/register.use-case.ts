import {
  CREATE_USER_USE_CASE,
  ICreateUserUseCase
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { RegisterUserRequestDto } from '../../presentation/dto/request/register-user.request.dto';
import { IRegister } from '../interfaces/auth.interface';
import { HashingProvider } from '../../infrastructure/providers/hashing.provider';

@Injectable()
export class Register implements IRegister {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(CREATE_USER_USE_CASE)
    private readonly createUserUseCase: ICreateUserUseCase
  ) {}

  async register(dto: RegisterUserRequestDto): Promise<void> {
    const password = await this.hashingProvider.hash(dto.password);

    return this.createUserUseCase.execute({
      ...dto,
      password
    });
  }
}
