import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Administrative view of an account, including the fields a user cannot see
 * about themselves: moderation `status` and the soft-deletion instant.
 *
 * Every timestamp is projected out of the embedded `registryDates`, which is
 * why this DTO declares them itself rather than extending
 * `TimestampResponseDto`.
 */
export class AdminUserResponseDto {
  @ApiProperty({
    description: 'Identifier of the account.',
    format: 'uuid',
    example: ExampleValue.USER_ID
  })
  @Expose()
  id!: string;

  @ApiPropertyOptional({
    description: 'Display name. `null` when the user has not set one.',
    type: String,
    nullable: true,
    example: ExampleValue.NAME
  })
  @Expose()
  name!: string | null;

  @ApiProperty({
    description: 'Unique username, always lowercase.',
    example: ExampleValue.USERNAME
  })
  @Expose()
  username!: string;

  @ApiProperty({
    description: 'Email address the account is registered under.',
    format: 'email',
    example: ExampleValue.EMAIL
  })
  @Expose()
  email!: string;

  @ApiProperty({
    description: 'Role held by the account.',
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER
  })
  @Expose()
  role!: UserRole;

  @ApiProperty({
    description:
      'Moderation state. `PENDING_VERIFICATION` accounts have never confirmed their email; only `ACTIVATE` accounts can authenticate.',
    enum: UserStatus,
    enumName: 'UserStatus',
    example: UserStatus.ACTIVATE
  })
  @Expose()
  status!: UserStatus;

  @ApiProperty({
    description:
      'Instant at which the account was registered. Identical to `createdAt`.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP,
    deprecated: true
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.createdAt)
  registeredAt!: Date;

  @ApiProperty({
    description: 'Instant at which the account was registered.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.createdAt)
  createdAt!: Date;

  @ApiProperty({
    description: 'Instant at which the account record was last modified.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.updatedAt)
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Instant at which the account was soft-deleted, or `null` while it is live.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.deletedAt ?? null)
  deletedAt!: Date | null;
}
