import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UpdateRoleRequestDto } from '../../presentation/dto/request/update-role.request.dto';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  RoleProtectedAction,
  RoleProtectionPolicy
} from '../../domain/role-protection.policy';
import {
  IRoleRepository,
  IUpdateRoleUseCase,
  ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UpdateRoleUseCase implements IUpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UpdateRoleUseCase.name);
  }

  async execute(roleId: string, dto: UpdateRoleRequestDto): Promise<void> {
    const role = await this.roleRepository.findById(roleId);

    if (!role) throw AuthorizationErrors.roleNotFound();

    RoleProtectionPolicy.assertMutable(role, RoleProtectedAction.RENAME);

    try {
      await this.roleRepository.update(roleId, {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {})
      });
    } catch (error: unknown) {
      if (
        dto.name !== undefined &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw AuthorizationErrors.roleNameConflict(dto.name);
      }
      throw error;
    }

    this.logger.info({ event: LogEvent.ROLE_UPDATED, roleId }, 'Role updated');
  }
}
