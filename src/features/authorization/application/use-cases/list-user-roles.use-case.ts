import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { Inject, Injectable } from '@nestjs/common';
import {
  IListUserRolesUseCase,
  IRoleRepository,
  IUserRoleRepository,
  ROLE_REPOSITORY,
  RoleWithPermissions,
  USER_ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

@Injectable()
export class ListUserRolesUseCase implements IListUserRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: IUserRoleRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository
  ) {}

  async execute(userId: string): Promise<RoleWithPermissions[]> {
    const target = await this.userRepository.findUserForAdmin(userId);

    if (!target) throw UserErrors.userNotFound(userId);

    const roles = await this.userRoleRepository.rolesForUser(userId);

    return Promise.all(
      roles.map(async (role) => ({
        role,
        permissions: await this.roleRepository.permissionsOf(role.id)
      }))
    );
  }
}
