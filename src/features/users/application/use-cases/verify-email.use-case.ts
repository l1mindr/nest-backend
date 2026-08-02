import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { SecurityErrors } from '@features/security/errors/security-errors';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IUserRepository,
  IVerificationCodeRepository,
  IVerifyEmailUseCase,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY
} from '../interfaces/users.interface';
import { VerificationCodeService } from '../services/verification-code.service';
import { VerificationAttemptService } from '../services/verification-attempt.service';
import { MAX_VERIFICATION_ATTEMPTS } from '../verification.constants';

@Injectable()
export class VerifyEmailUseCase implements IVerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly verificationAttemptService: VerificationAttemptService,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(VerifyEmailUseCase.name);
  }

  async execute(email: string, code: string): Promise<void> {
    if (await this.verificationAttemptService.isEmailRateLimitExceeded(email)) {
      throw SecurityErrors.rateLimitExceeded();
    }

    const user = await this.userRepository.findByEmailOrUsernameForAuth(email);

    if (!user) {
      throw UserErrors.invalidVerificationCode();
    }

    if (user.status !== UserStatus.PENDING_VERIFICATION) {
      throw UserErrors.invalidVerificationCode();
    }

    const verification =
      await this.verificationCodeRepository.findLatestByUserId(user.id);

    if (!verification) {
      throw UserErrors.invalidVerificationCode();
    }

    if (this.verificationCodeService.isExpired(verification.expiresAt)) {
      throw UserErrors.invalidVerificationCode();
    }

    const isValid = await this.verificationCodeService.validate(
      code,
      verification.codeHash
    );

    if (!isValid) {
      await this.handleFailedAttempt(user.id);
      throw UserErrors.invalidVerificationCode();
    }

    const now = this.clockService.nowDate();

    await this.dataSource.transaction(async (manager) => {
      await this.verificationCodeRepository.markVerified(
        verification.id,
        now,
        manager
      );
      await this.userRepository.updateStatus(
        user.id,
        UserStatus.ACTIVATE,
        manager
      );
    });

    await this.verificationAttemptService.resetFailedAttempts(user.id);

    this.logger.info(
      { event: LogEvent.EMAIL_VERIFIED, userId: user.id },
      'User verified their email'
    );
  }

  private async handleFailedAttempt(userId: string): Promise<void> {
    const attempts =
      await this.verificationAttemptService.incrementFailedAttempt(userId);

    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      const now = this.clockService.nowDate();

      await this.verificationCodeRepository.invalidatePreviousCodes(
        userId,
        now
      );
      await this.verificationAttemptService.resetFailedAttempts(userId);

      this.logger.warn(
        {
          event: LogEvent.VERIFICATION_ATTEMPTS_EXCEEDED,
          userId
        },
        'Max verification attempts exceeded; code invalidated'
      );
    }
  }
}
