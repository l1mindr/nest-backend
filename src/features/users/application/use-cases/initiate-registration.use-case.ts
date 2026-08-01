import { EmailService } from '@infrastructure/email/email.service';
import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { CreateUserRequestDto } from '../../presentation/dto/request/create-user.request.dto';
import { User } from '../../domain/entities/user.entity';
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
import { VERIFICATION_CODE_TTL_MS } from '../verification.constants';

@Injectable()
export class InitiateRegistrationUseCase implements IInitiateRegistrationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly clockService: ClockService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(InitiateRegistrationUseCase.name);
  }

  async execute(dto: CreateUserRequestDto): Promise<void> {
    const code = this.verificationCodeService.generate();
    const codeHash = await this.verificationCodeService.hash(code);
    const now = this.clockService.nowDate();
    const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await this.userRepository.insertUser(
          {
            ...dto,
            status: UserStatus.PENDING_VERIFICATION
          },
          manager
        );

        await this.verificationCodeRepository.store(
          created.id,
          codeHash,
          expiresAt,
          manager
        );

        return created;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }

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
        'Verification email delivery failed after registration'
      );
    }
  }
}
