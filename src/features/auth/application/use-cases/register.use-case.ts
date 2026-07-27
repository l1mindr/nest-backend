import {
  CREATE_USER_SERVICE,
  ICreateUserService
} from '@features/users/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { RegisterUserRequestDto } from '../../dto/request/register-user.request.dto';
import { IRegister } from '../../interfaces/auth.interface';
import { HashingProvider } from '../../providers/hashing.provider';

@Injectable()
export class Register implements IRegister {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(CREATE_USER_SERVICE)
    private readonly createUserService: ICreateUserService
  ) {}

  async register(dto: RegisterUserRequestDto): Promise<void> {
    const password = await this.hashingProvider.hash(dto.password);

    return this.createUserService.createUser({
      ...dto,
      password
    });
  }
}
