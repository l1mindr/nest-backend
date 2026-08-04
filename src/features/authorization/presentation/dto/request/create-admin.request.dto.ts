import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../../domain/enums/permission.enum';

export class CreateAdminRequestDto {
  @ApiProperty({
    description:
      'Identifier of the existing, active account to promote. Administrators are ordinary accounts holding the `ADMIN` role, so registration, email verification and password handling stay on the one path they already follow.',
    format: 'uuid',
    example: ExampleValue.USER_ID
  })
  @IsString()
  @IsUUID()
  readonly userId!: string;

  @ApiPropertyOptional({
    description:
      'Permissions to grant on promotion. Omit for an administrator with no permissions at all, then grant through `POST /v1/admin/admins/{id}/permissions`.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ, Permission.USER_SUSPEND]
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsEnum(Permission, { each: true })
  readonly permissions?: Permission[];
}
