import { EmailService } from '@infrastructure/email/email.service';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { ImperativeRateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import {
  IRateLimitService,
  RATE_LIMIT_SERVICE
} from '@features/security/rate-limit/services/rate-limit.service';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserStatus } from '../../domain/enums/user-status.enum';
import {
  IResendVerificationUseCase,
  IUserRepository,
  IVerificationCodeRepository,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY
} from '../interfaces/users.interface';
import { VerificationCodeService } from '../services/verification-code.service';
import {
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_CODE_TTL_MS
} from '../verification.constants';

@Injectable()
export class ResendVerificationUseCase implements IResendVerificationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimitService: IRateLimitService,
    private readonly clockService: ClockService,
    private readonly emailService: EmailService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ResendVerificationUseCase.name);
  }

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findByEmailOrUsernameForAuth(email);

    if (!user) return;
    if (user.status !== UserStatus.PENDING_VERIFICATION) return;

    const hourly = await this.rateLimitService.consume(
      ImperativeRateLimitPolicies.ResendHourly,
      user.id
    );

    if (!hourly.allowed) {
      this.logger.warn(
        {
          event: LogEvent.VERIFICATION_RESEND_LIMIT_EXCEEDED,
          userId: user.id
        },
        'Hourly resend limit exceeded; resend skipped'
      );
      return;
    }

    const cooldown = await this.rateLimitService.consume(
      ImperativeRateLimitPolicies.ResendCooldown,
      user.id
    );

    if (!cooldown.allowed) return;

    const now = this.clockService.nowDate();

    await this.verificationCodeRepository.invalidatePreviousCodes(user.id, now);
    await this.rateLimitService.reset(
      ImperativeRateLimitPolicies.VerificationAttempts,
      user.id
    );

    const code = this.verificationCodeService.generate();
    const codeHash = await this.verificationCodeService.hash(code);
    const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

    await this.verificationCodeRepository.store(user.id, codeHash, expiresAt);

    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        code,
        VERIFICATION_CODE_TTL_MINUTES
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          event: LogEvent.EMAIL_SEND_FAILED,
          userId: user.id,
          err: error
        },
        'Verification email delivery failed on resend'
      );
    }
  }
}
