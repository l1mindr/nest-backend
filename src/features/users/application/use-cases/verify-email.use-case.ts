import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { ImperativeRateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import {
  IRateLimitService,
  RATE_LIMIT_SERVICE
} from '@features/security/rate-limit/services/rate-limit.service';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
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

@Injectable()
export class VerifyEmailUseCase implements IVerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimitService: IRateLimitService,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.setContext(VerifyEmailUseCase.name);
  }

  async execute(email: string, code: string): Promise<void> {
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

    await this.rateLimitService.reset(
      ImperativeRateLimitPolicies.VerificationAttempts,
      user.id
    );

    this.logger.info(
      { event: LogEvent.EMAIL_VERIFIED, userId: user.id },
      'User verified their email'
    );

    this.auditLogService.record({
      action: AuditAction.EMAIL_VERIFICATION,
      actorType: ActorType.USER,
      userId: user.id,
      resourceType: ResourceType.USER,
      resourceId: user.id,
      success: true
    });
  }

  private async handleFailedAttempt(userId: string): Promise<void> {
    const attempt = await this.rateLimitService.consume(
      ImperativeRateLimitPolicies.VerificationAttempts,
      userId
    );

    if (attempt.remaining === 0) {
      const now = this.clockService.nowDate();

      await this.verificationCodeRepository.invalidatePreviousCodes(
        userId,
        now
      );
      await this.rateLimitService.reset(
        ImperativeRateLimitPolicies.VerificationAttempts,
        userId
      );

      this.logger.warn(
        { event: LogEvent.VERIFICATION_ATTEMPTS_EXCEEDED, userId },
        'Max verification attempts exceeded; code invalidated'
      );
    }
  }
}
