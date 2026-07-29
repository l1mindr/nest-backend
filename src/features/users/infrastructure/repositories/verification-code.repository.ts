import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { IVerificationCodeRepository } from '../../application/interfaces/users.interface';
import { UserVerificationCode } from '../../domain/entities/user-verification-code.entity';

@Injectable()
export class VerificationCodeRepository implements IVerificationCodeRepository {
  private get repo(): Repository<UserVerificationCode> {
    return this.dataSource.getRepository(UserVerificationCode);
  }

  constructor(private readonly dataSource: DataSource) {}

  async store(
    userId: string,
    codeHash: string,
    expiresAt: Date
  ): Promise<UserVerificationCode> {
    return this.repo.save(
      this.repo.create({
        userId,
        codeHash,
        expiresAt
      })
    );
  }

  async findLatestByUserId(
    userId: string
  ): Promise<UserVerificationCode | null> {
    return this.repo.findOne({
      where: { userId, verifiedAt: IsNull() },
      order: { registryDates: { createdAt: 'DESC' } }
    });
  }

  async markVerified(id: string, verifiedAt: Date): Promise<void> {
    await this.repo.update(id, { verifiedAt });
  }

  async invalidatePreviousCodes(userId: string, now: Date): Promise<void> {
    await this.repo.update(
      { userId, verifiedAt: IsNull() },
      { verifiedAt: now }
    );
  }
}
