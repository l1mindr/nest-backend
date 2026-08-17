import {
  ISessionRevocationUseCase,
  SESSION_REVOCATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { TokenErrors } from '@features/token/errors/token-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { ChangePasswordRequestDto } from '../../presentation/dto/request/change-password.request.dto';
import { AuthErrors } from '../../domain/errors/auth-errors';
import { IChangePassword } from '../interfaces/auth.interface';
import { HashingProvider } from '../../infrastructure/providers/hashing.provider';

@Injectable()
export class ChangePassword implements IChangePassword {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REVOCATION_USE_CASE)
    private readonly revocationUseCase: ISessionRevocationUseCase,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(ChangePassword.name);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordRequestDto
  ): Promise<void> {
    const userWithPassword =
      await this.userRepository.findUserWithPassword(userId);

    if (!userWithPassword) throw TokenErrors.invalidToken();

    const [isMatch, password] = await Promise.all([
      this.hashingProvider.compare(currentPassword, userWithPassword.password),
      this.hashingProvider.hash(newPassword)
    ]);

    if (!isMatch) throw AuthErrors.invalidCurrentPassword();

    if (newPassword === currentPassword) {
      throw AuthErrors.passwordMustBeDifferent();
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.userRepository.updatePasswordHash(userId, password, manager);
        await this.revocationUseCase.terminateOthers(
          userId,
          sessionId,
          manager
        );
      });
    } catch (error) {
      this.logger.error(
        { event: LogEvent.PASSWORD_CHANGED, userId, sessionId, err: error },
        'Password change transaction failed'
      );
      throw AuthErrors.passwordChangeFailed();
    }

    this.logger.info(
      { event: LogEvent.PASSWORD_CHANGED, userId, sessionId },
      'User changed password'
    );

    this.auditLogService.record({
      action: AuditAction.PASSWORD_CHANGE,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.USER,
      resourceId: userId,
      success: true
    });
  }
}
