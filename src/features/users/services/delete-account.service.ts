import {
  IRevokeAllUserSessionsService,
  REVOKE_ALL_USER_SESSIONS_SERVICE
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
    @Inject(REVOKE_ALL_USER_SESSIONS_SERVICE)
    private readonly revokeAllUserSessionsService: IRevokeAllUserSessionsService,
    private readonly dataSource: DataSource
  ) {}

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(user);
      await this.revokeAllUserSessionsService.revokeAllForUser(userId, manager);
    });
  }
}
