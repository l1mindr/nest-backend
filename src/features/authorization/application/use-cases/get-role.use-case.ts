import { Inject, Injectable } from '@nestjs/common';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  IGetRoleUseCase,
  IRoleRepository,
  ROLE_REPOSITORY,
  RoleWithPermissions
} from '../interfaces/authorization.interface';

@Injectable()
export class GetRoleUseCase implements IGetRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository
  ) {}

  async execute(roleId: string): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findById(roleId);

    if (!role) throw AuthorizationErrors.roleNotFound();

    return {
      role,
      permissions: await this.roleRepository.permissionsOf(role.id)
    };
  }
}
