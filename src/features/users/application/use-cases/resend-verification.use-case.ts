import { EmailService } from '@infrastructure/email/email.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { ClockService } from '@infrastructure/clock/clock.service';
import { Inject, Injectable } from '@nestjs/common';
import {
  IResendVerificationUseCase,
  IUserRepository,
  IVerificationCodeRepository,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY
} from '../interfaces/users.interface';
import { VerificationCodeService } from '../services/verification-code.service';

@Injectable()
export class ResendVerificationUseCase implements IResendVerificationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly clockService: ClockService,
    private readonly emailService: EmailService
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findByEmailOrUsernameForAuth(email);

    if (!user) return;

    const now = this.clockService.nowDate();

    await this.verificationCodeRepository.invalidatePreviousCodes(user.id, now);

    const code = this.verificationCodeService.generate();
    const codeHash = await this.verificationCodeService.hash(code);
    const expiresAt = new Date(now.getTime() + 3 * TimeConstants.MS_PER_MINUTE);

    await this.verificationCodeRepository.store(user.id, codeHash, expiresAt);

    await this.emailService.sendVerificationEmail(user.email, code);
  }
}
