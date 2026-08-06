import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AdminInvitationStatus } from '../../../domain/admin-invitation.policy';
import { Permission } from '../../../domain/enums/permission.enum';

/**
 * An invitation as the owner sees it. The token is never included: it exists in
 * the invitee's mailbox and as a digest in the database, and nowhere else.
 */
export class AdminInvitationResponseDto {
  @ApiProperty({
    description: 'Identifier of the invitation, used to revoke it.',
    format: 'uuid',
    example: ExampleValue.USER_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Address the invitation was sent to.',
    format: 'email',
    example: ExampleValue.EMAIL
  })
  @Expose()
  email!: string;

  @ApiProperty({
    description:
      'Derived state. `PENDING` is the only one that can still be accepted; `EXPIRED` is computed from `expiresAt` rather than stored.',
    enum: AdminInvitationStatus,
    enumName: 'AdminInvitationStatus',
    example: AdminInvitationStatus.PENDING
  })
  @Expose()
  status!: AdminInvitationStatus;

  @ApiProperty({
    description: 'Permissions the account will receive on acceptance.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ]
  })
  @Expose()
  permissions!: Permission[];

  @ApiProperty({
    description: 'Instant after which the token stops being accepted.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  expiresAt!: Date;

  @ApiPropertyOptional({
    description: 'When the invitation was accepted, or `null`.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null
  })
  @Expose()
  acceptedAt!: Date | null;

  @ApiPropertyOptional({
    description: 'When the invitation was revoked, or `null`.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null
  })
  @Expose()
  revokedAt!: Date | null;

  @ApiPropertyOptional({
    description:
      'Account that issued the invitation. `null` once that account has been deleted.',
    type: String,
    format: 'uuid',
    nullable: true,
    example: ExampleValue.ADMIN_ID
  })
  @Expose()
  invitedById!: string | null;

  @ApiProperty({
    description: 'Instant at which the invitation was issued.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  createdAt!: Date;
}
