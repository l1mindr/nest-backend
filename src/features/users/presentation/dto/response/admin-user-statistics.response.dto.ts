import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Aggregate over the account population, for the administrative summary cards.
 *
 * Separate from `GET /v1/admin/users` on purpose. That endpoint pages the
 * `USER` population, so a total counted from its items is both role-scoped and
 * page-scoped; this one answers over every account in a single query.
 */
export class AdminUserStatisticsResponseDto {
  @ApiProperty({
    description:
      'Number of accounts that exist, across every role — the owner and the administrators included. Soft-deleted accounts are excluded. Use `byRole.USER` for the regular-user population.',
    type: Number,
    minimum: 0,
    example: 3
  })
  total!: number;

  @ApiProperty({
    description:
      'Accounts per role. The keys are exhaustive: a role nobody holds reports 0 rather than being absent.',
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: {
      [UserRole.OWNER]: 1,
      [UserRole.ADMIN]: 0,
      [UserRole.USER]: 2
    }
  })
  byRole!: Record<UserRole, number>;

  @ApiProperty({
    description:
      'Accounts per moderation status, over the same population as `total`. The keys are exhaustive.',
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: {
      [UserStatus.ACTIVATE]: 1,
      [UserStatus.DEACTIVATE]: 0,
      [UserStatus.SUSPEND]: 0,
      [UserStatus.PENDING_VERIFICATION]: 2
    }
  })
  byStatus!: Record<UserStatus, number>;
}
