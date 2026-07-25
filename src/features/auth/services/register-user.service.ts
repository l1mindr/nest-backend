import {
  IUsersService,
  USER_SERVICE
} from '@features/users/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';
import { IRegisterUserService } from '../interfaces/auth.interface';
import { HashingProvider } from '../providers/hashing.provider';

@Injectable()
export class RegisterUserService implements IRegisterUserService {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(USER_SERVICE)
    private readonly usersService: IUsersService
  ) {}

  async register(dto: RegisterUserRequestDto): Promise<void> {
    const password = await this.hashingProvider.hash(dto.password);

    return this.usersService.register({
      ...dto,
      password
    });
  }
}
