import { Inject, Injectable } from '@nestjs/common';
import {
  IListRolesUseCase,
  IRoleRepository,
  ROLE_REPOSITORY,
  RoleWithPermissions
} from '../interfaces/authorization.interface';

@Injectable()
export class ListRolesUseCase implements IListRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository
  ) {}

  async execute(): Promise<RoleWithPermissions[]> {
    const roles = await this.roleRepository.findAll();

    return Promise.all(
      roles.map(async (role) => ({
        role,
        permissions: await this.roleRepository.permissionsOf(role.id)
      }))
    );
  }
}
