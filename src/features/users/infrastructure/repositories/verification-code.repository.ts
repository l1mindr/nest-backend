import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
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
    expiresAt: Date,
    manager?: EntityManager
  ): Promise<UserVerificationCode> {
    const repository =
      manager?.getRepository(UserVerificationCode) ?? this.repo;

    return repository.save(
      repository.create({
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

  async markVerified(
    id: string,
    verifiedAt: Date,
    manager?: EntityManager
  ): Promise<void> {
    const repository =
      manager?.getRepository(UserVerificationCode) ?? this.repo;

    await repository.update(id, { verifiedAt });
  }

  async invalidatePreviousCodes(userId: string, now: Date): Promise<void> {
    await this.repo.update(
      { userId, verifiedAt: IsNull() },
      { verifiedAt: now }
    );
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"createdAt" < :cutoff', { cutoff })
      .execute();

    return result.affected ?? 0;
  }
}
