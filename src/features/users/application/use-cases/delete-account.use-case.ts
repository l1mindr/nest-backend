import { OwnerProtectionPolicy } from '@features/authorization/domain/owner-protection.policy';
import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
import { User } from '../../domain/entities/user.entity';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IDeleteAccountUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';

@Injectable()
export class DeleteAccountUseCase implements IDeleteAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    OwnerProtectionPolicy.assertDeletable(user);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(user);
      await this.revocationUseCase.revokeAll(userId, manager);
    });

    this.auditLogService.record({
      action: AuditAction.ACCOUNT_DELETED,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.USER,
      resourceId: userId,
      success: true
    });
  }
}
