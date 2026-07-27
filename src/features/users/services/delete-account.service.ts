import {
  ISessionRevocationService,
  SESSION_REVOCATION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { User } from '@features/users/entities/user.entity';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserErrors } from '../errors/user-errors';
import {
  IDeleteAccountService,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class DeleteAccountService implements IDeleteAccountService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_SERVICE)
    private readonly revocationService: ISessionRevocationService,
    private readonly dataSource: DataSource
  ) {}

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(user);
      await this.revocationService.revokeAll(userId, manager);
    });
  }
}
