import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Permission } from '../../../domain/enums/permission.enum';

export class RoleResponseDto {
  @ApiProperty({
    description: 'Identifier of the role.',
    format: 'uuid',
    example: ExampleValue.ADMIN_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Unique, machine-readable name of the role.',
    example: 'SUPPORT'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description: 'What this role is for.',
    example: 'Read-only access to the user directory and audit trail.'
  })
  @Expose()
  description!: string;

  @ApiProperty({
    description:
      'Whether this is a built-in role (`OWNER`, `ADMIN`, `USER`). System roles cannot be renamed, re-permissioned or deleted.',
    example: false
  })
  @Expose()
  isSystem!: boolean;

  @ApiProperty({
    description:
      'Permissions this role grants to every account assigned to it.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ]
  })
  @Expose()
  permissions!: Permission[];

  @ApiProperty({
    description: 'Instant at which the role was created.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: 'Instant at which the role was last modified.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  updatedAt!: Date;
}
