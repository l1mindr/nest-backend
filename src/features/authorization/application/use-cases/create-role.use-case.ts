import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateRoleRequestDto } from '../../presentation/dto/request/create-role.request.dto';
import { Role } from '../../domain/entities/role.entity';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  ICreateRoleUseCase,
  IRoleRepository,
  ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

const UNIQUE_VIOLATION = '23505';

/**
 * Creates a custom role.
 *
 * A new role starts with no permissions — `PUT /roles/:id/permissions` is a
 * separate, owner-only step, so a role can never come into existence already
 * holding reach nobody explicitly granted it.
 */
@Injectable()
export class CreateRoleUseCase implements ICreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CreateRoleUseCase.name);
  }

  async execute(dto: CreateRoleRequestDto): Promise<Role> {
    const existing = await this.roleRepository.findByName(dto.name);

    if (existing) throw AuthorizationErrors.roleNameConflict(dto.name);

    let role: Role;
    try {
      role = await this.roleRepository.create({
        name: dto.name,
        description: dto.description ?? ''
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw AuthorizationErrors.roleNameConflict(dto.name);
      }
      throw error;
    }

    this.logger.info(
      { event: LogEvent.ROLE_CREATED, roleId: role.id, name: role.name },
      'Role created'
    );

    return role;
  }
}
