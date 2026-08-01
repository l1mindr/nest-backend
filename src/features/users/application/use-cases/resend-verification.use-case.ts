import { EmailService } from '@infrastructure/email/email.service';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
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
import { VerificationAttemptService } from '../services/verification-attempt.service';
import { VERIFICATION_CODE_TTL_MS } from '../verification.constants';

@Injectable()
export class ResendVerificationUseCase implements IResendVerificationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly verificationAttemptService: VerificationAttemptService,
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

    const acquired =
      await this.verificationAttemptService.acquireResendCooldown(user.id);

    if (!acquired) return;

    const now = this.clockService.nowDate();

    await this.verificationCodeRepository.invalidatePreviousCodes(user.id, now);

    const code = this.verificationCodeService.generate();
    const codeHash = await this.verificationCodeService.hash(code);
    const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

    await this.verificationCodeRepository.store(user.id, codeHash, expiresAt);

    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        code,
        expiresAt
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
