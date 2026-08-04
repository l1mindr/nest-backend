import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { throwOnUniqueConstraint } from '@features/users/infrastructure/providers/unique-constraint.handler';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UpdateAdminRequestDto } from '../../presentation/dto/request/update-admin.request.dto';
import { ProtectedAction } from '../../domain/owner-protection.policy';
import { AdminAccountService } from '../services/admin-account.service';
import { IUpdateAdminUseCase } from '../interfaces/authorization.interface';

/**
 * Edits another administrator's profile.
 *
 * Guarded by `ADMIN_UPDATE`, and refused against the owner and against the
 * caller's own account — the latter has the self-service endpoint, and allowing
 * both paths would mean two places to reason about when deciding what an
 * administrator may change about themselves.
 */
@Injectable()
export class UpdateAdminUseCase implements IUpdateAdminUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly adminAccountService: AdminAccountService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UpdateAdminUseCase.name);
  }

  async execute(
    actorId: string,
    targetId: string,
    dto: UpdateAdminRequestDto
  ): Promise<void> {
    await this.adminAccountService.loadManageableAdmin(
      actorId,
      targetId,
      ProtectedAction.PROFILE_UPDATE
    );

    try {
      await this.userRepository.updateUserProfile(targetId, dto);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }

    this.logger.info(
      {
        event: LogEvent.ADMIN_PROFILE_UPDATED,
        actorId,
        userId: targetId
      },
      'Administrator profile updated'
    );
  }
}
