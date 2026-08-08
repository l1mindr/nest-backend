import { ClockService } from '@infrastructure/clock/clock.service';
import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { Inject, Injectable } from '@nestjs/common';
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
import {
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_CODE_TTL_MS
} from '../verification.constants';

@Injectable()
export class InitiateRegistrationUseCase implements IInitiateRegistrationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly verificationCodeRepository: IVerificationCodeRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly clockService: ClockService,
    private readonly emailPublisher: EmailPublisher,
    private readonly dataSource: DataSource
  ) {}

  async execute(dto: CreateUserRequestDto): Promise<void> {
    const code = this.verificationCodeService.generate();
    const codeHash = await this.verificationCodeService.hash(code);
    const now = this.clockService.nowDate();
    const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

    let user: User;
    let verificationCodeId: string;

    try {
      ({ user, verificationCodeId } = await this.dataSource.transaction(
        async (manager) => {
          const created = await this.userRepository.insertUser(
            {
              ...dto,
              status: UserStatus.PENDING_VERIFICATION
            },
            manager
          );

          const verificationCode = await this.verificationCodeRepository.store(
            created.id,
            codeHash,
            expiresAt,
            manager
          );

          return { user: created, verificationCodeId: verificationCode.id };
        }
      ));
    } catch (error: unknown) {
      throwOnUniqueConstraint(error);
    }

    // Published after the commit, never inside it: a rolled-back registration
    // would otherwise leave a queued email naming an account that never
    // existed, and the worker has no way to tell that it should not send.
    //
    // The stored code row identifies the occasion, so a registration retried by
    // the client sends one email per issued code rather than one per attempt.
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
          verificationCodeId
        )
      }
    );
  }
}
