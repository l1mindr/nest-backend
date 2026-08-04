import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Permission } from '../../../domain/enums/permission.enum';

/**
 * An administrator together with the permissions they hold.
 *
 * The permission list is the point of this projection: the administrative user
 * view already reports role and status, but not what the account can actually
 * reach — which is now the only thing that decides it.
 */
export class AdminAccountResponseDto {
  @ApiProperty({
    description: 'Identifier of the account.',
    format: 'uuid',
    example: ExampleValue.ADMIN_ID
  })
  @Expose()
  id!: string;

  @ApiPropertyOptional({
    description: 'Display name. `null` when the administrator has not set one.',
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
    description: 'Role tier held by the account.',
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.ADMIN
  })
  @Expose()
  role!: UserRole;

  @ApiProperty({
    description:
      'Moderation state. Only `ACTIVATE` administrators can authenticate and therefore exercise any permission.',
    enum: UserStatus,
    enumName: 'UserStatus',
    example: UserStatus.ACTIVATE
  })
  @Expose()
  status!: UserStatus;

  @ApiProperty({
    description:
      'Permissions granted to this administrator. Empty means the account holds the role but can reach nothing. The owner is reported as holding every permission, since they bypass evaluation entirely.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ, Permission.USER_SUSPEND]
  })
  @Expose()
  permissions!: Permission[];

  @ApiProperty({
    description: 'Instant at which the account was registered.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: 'Instant at which the account record was last modified.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  updatedAt!: Date;
}
