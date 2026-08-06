import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository
} from 'typeorm';
import { AdminInvitation } from '../../domain/entities/admin-invitation.entity';
import { IAdminInvitationRepository } from '../../application/interfaces/authorization.interface';

@Injectable()
export class AdminInvitationRepository implements IAdminInvitationRepository {
  private get invitationRepo(): Repository<AdminInvitation> {
    return this.dataSource.getRepository(AdminInvitation);
  }

  constructor(private readonly dataSource: DataSource) {}

  private repoFor(manager?: EntityManager): Repository<AdminInvitation> {
    return manager?.getRepository(AdminInvitation) ?? this.invitationRepo;
  }

  async create(
    invitation: Partial<AdminInvitation>,
    manager?: EntityManager
  ): Promise<AdminInvitation> {
    const repository = this.repoFor(manager);

    return repository.save(repository.create(invitation));
  }

  async findById(id: string): Promise<AdminInvitation | null> {
    return this.invitationRepo.findOne({ where: { id } });
  }

  /**
   * The unauthenticated lookup. Indexed on the digest, so a wrong token costs a
   * single miss and cannot be told apart from a token that was never issued.
   */
  async findByTokenHash(tokenHash: string): Promise<AdminInvitation | null> {
    return this.invitationRepo.findOne({ where: { tokenHash } });
  }

  /** Cursor-paginated over the invitation log, newest identifiers last. */
  async findPage(
    cursorId: string | null,
    limit: number
  ): Promise<AdminInvitation[]> {
    return this.invitationRepo.find({
      where: cursorId ? { id: MoreThan(cursorId) } : undefined,
      order: { id: 'ASC' },
      take: limit
    });
  }

  /** Whatever is still outstanding for this address, accepted or not. */
  async findPendingByEmail(email: string): Promise<AdminInvitation[]> {
    return this.invitationRepo.find({
      where: { email, acceptedAt: IsNull(), revokedAt: IsNull() }
    });
  }

  async markRevoked(
    id: string,
    revokedAt: Date,
    manager?: EntityManager
  ): Promise<void> {
    await this.repoFor(manager).update({ id }, { revokedAt });
  }

  async markAccepted(
    id: string,
    acceptedAt: Date,
    acceptedUserId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.repoFor(manager).update({ id }, { acceptedAt, acceptedUserId });
  }
}
