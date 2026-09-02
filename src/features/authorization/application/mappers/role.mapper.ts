import { Injectable } from '@nestjs/common';
import { RoleResponseDto } from '../../presentation/dto/response/role.response.dto';
import { RoleWithPermissions } from '../interfaces/authorization.interface';

@Injectable()
export class RoleMapper {
  toResponse({ role, permissions }: RoleWithPermissions): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: [...permissions],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }

  toResponseList(roles: RoleWithPermissions[]): RoleResponseDto[] {
    return roles.map((entry) => this.toResponse(entry));
  }
}
