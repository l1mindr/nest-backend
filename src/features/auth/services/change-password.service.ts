import {
  ITerminateOtherSessionsService,
  TERMINATE_OTHER_SESSIONS_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { TokenErrors } from '@features/token/errors/token-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/interfaces/users.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { ChangePasswordRequestDto } from '../dto/request/change-password.request.dto';
import { AuthErrors } from '../errors/auth-errors';
import { IChangePasswordService } from '../interfaces/auth.interface';
import { HashingProvider } from '../providers/hashing.provider';

@Injectable()
export class ChangePasswordService implements IChangePasswordService {
  constructor(
    private readonly hashingProvider: HashingProvider,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(TERMINATE_OTHER_SESSIONS_SERVICE)
    private readonly terminateOtherSessionsService: ITerminateOtherSessionsService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ChangePasswordService.name);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordRequestDto
  ): Promise<void> {
    const userWithPassword =
      await this.userRepository.findByIdWithPassword(userId);

    if (!userWithPassword) throw TokenErrors.invalidToken();

    const isMatch = await this.hashingProvider.compare(
      currentPassword,
      userWithPassword.password
    );

    if (!isMatch) throw AuthErrors.invalidCurrentPassword();

    const isSame = await this.hashingProvider.compare(
      newPassword,
      userWithPassword.password
    );

    if (isSame) throw AuthErrors.passwordMustBeDifferent();

    const password = await this.hashingProvider.hash(newPassword);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.userRepository.setPassword(userId, password, manager);
        await this.terminateOtherSessionsService.terminateOthers(
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
  }
}
