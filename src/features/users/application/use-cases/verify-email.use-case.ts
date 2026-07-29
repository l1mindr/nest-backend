import { ClockService } from '@infrastructure/clock/clock.service';
import { Inject, Injectable } from '@nestjs/common';
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
    private readonly clockService: ClockService
  ) {}

  async execute(email: string, code: string): Promise<void> {
    const user = await this.userRepository.findByEmailOrUsernameForAuth(email);

    if (!user) {
      throw UserErrors.invalidVerificationCode();
    }

    const verification =
      await this.verificationCodeRepository.findLatestByUserId(user.id);

    if (!verification) {
      throw UserErrors.invalidVerificationCode();
    }

    if (
      this.verificationCodeService.isExpired(
        verification.registryDates.createdAt
      )
    ) {
      throw UserErrors.expiredVerificationCode();
    }

    const isValid = await this.verificationCodeService.validate(
      code,
      verification.codeHash
    );

    if (!isValid) {
      throw UserErrors.invalidVerificationCode();
    }

    const now = this.clockService.nowDate();

    await this.verificationCodeRepository.markVerified(verification.id, now);

    await this.userRepository.updateStatus(user.id, UserStatus.ACTIVATE);
  }
}
