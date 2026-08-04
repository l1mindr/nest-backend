import { Injectable } from '@nestjs/common';
import { AdminAccountResponseDto } from '../../presentation/dto/response/admin-account.response.dto';
import { PermissionDefinitionResponseDto } from '../../presentation/dto/response/permission-definition.response.dto';
import { PermissionDefinition } from '../../domain/entities/permission-definition.entity';
import { AdminAccount } from '../interfaces/authorization.interface';

/**
 * Flattens an administrator and their grants into the response shape.
 *
 * Done by hand rather than through `plainToInstance` because the source is two
 * objects, and because the timestamps live inside the embedded `registryDates`
 * of the account rather than on it.
 */
@Injectable()
export class AdminAccountMapper {
  toResponse({ account, permissions }: AdminAccount): AdminAccountResponseDto {
    return {
      id: account.id,
      name: account.name ?? null,
      username: account.username,
      email: account.email,
      role: account.role,
      status: account.status,
      permissions: [...permissions],
      createdAt: account.registryDates.createdAt,
      updatedAt: account.registryDates.updatedAt
    };
  }

  toResponseList(accounts: AdminAccount[]): AdminAccountResponseDto[] {
    return accounts.map((admin) => this.toResponse(admin));
  }

  toCatalogList(
    definitions: PermissionDefinition[]
  ): PermissionDefinitionResponseDto[] {
    return definitions.map(({ code, description }) => ({
      code: code as PermissionDefinitionResponseDto['code'],
      description
    }));
  }
}
