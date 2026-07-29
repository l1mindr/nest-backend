import { EmailService } from '@infrastructure/email/email.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { ClockService } from '@infrastructure/clock/clock.service';
import { Inject, Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from '../../presentation/dto/request/create-user.request.dto';
import { UserStatus } from '../../domain/enums/user-status.enum';
import {
  IInitiateRegistrationUseCase,
  IUserRepository,
  IVerificationCodeRepository,
  USER_REPOSITORY,
  VERIFICATION_CODE_REPOSITORY
} from '../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../infrastructure/providers/unique-constraint.handler';
import { VerificationCodeService } from '../services/verification-code.service';

@Injectable()
export class InitiateRegistrationUseCase implements IInitiateRegistrationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly clockService: ClockService,
    private readonly emailService: EmailService
  ) {}

  async execute(dto: CreateUserRequestDto): Promise<void> {
    try {
      const user = await this.userRepository.insertUser({
        ...dto,
        status: UserStatus.PENDING_VERIFICATION
      });

      const code = this.verificationCodeService.generate();
      const codeHash = await this.verificationCodeService.hash(code);
      const now = this.clockService.nowDate();
      const expiresAt = new Date(
        now.getTime() + 3 * TimeConstants.MS_PER_MINUTE
      );

      await this.verificationCodeRepository.store(user.id, codeHash, expiresAt);

      await this.emailService.sendVerificationEmail(user.email, code);
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }
  }
}
