import { ClockService } from '@infrastructure/clock/clock.service';
import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
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
    private readonly emailPublisher: EmailPublisher,
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

    const verificationCode = await this.verificationCodeRepository.store(
      user.id,
      codeHash,
      expiresAt
    );

    // Keyed on the stored code row, so the email that arrives always matches the
    // code the database will accept.
    await this.emailPublisher.publish(
      {
        type: EmailMessageType.VERIFICATION,
        to: user.email,
        data: {
          code,
          expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES
        }
      },
      {
        dedupeKey: emailDedupeKey(
          EmailMessageType.VERIFICATION,
          verificationCode.id
        )
      }
    );
  }
}
