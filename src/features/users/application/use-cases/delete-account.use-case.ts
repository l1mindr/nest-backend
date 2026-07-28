import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { User } from '../../entities/user.entity';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserErrors } from '../../errors/user-errors';
import {
  IDeleteAccountUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../../interfaces/users.interface';

@Injectable()
export class DeleteAccountUseCase implements IDeleteAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly dataSource: DataSource
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(user);
      await this.revocationUseCase.revokeAll(userId, manager);
    });
  }
}
