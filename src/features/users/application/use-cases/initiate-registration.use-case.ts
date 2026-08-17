import { ClockService } from '@infrastructure/clock/clock.service';
import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
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
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService
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
            { ...dto, status: UserStatus.PENDING_VERIFICATION },
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

    // Published after the commit; see original comment.
    await this.emailPublisher.publish(
      {
        type: EmailMessageType.VERIFICATION,
        to: user.email,
        data: { code, expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES }
      },
      {
        dedupeKey: emailDedupeKey(
          EmailMessageType.VERIFICATION,
          verificationCodeId
        )
      }
    );

    this.auditLogService.record({
      action: AuditAction.USER_REGISTER,
      actorType: ActorType.ANONYMOUS,
      userId: user.id,
      resourceType: ResourceType.USER,
      resourceId: user.id,
      success: true
    });
  }
}
