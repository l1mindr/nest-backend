import { EmailField } from '@presentation/validation/fields/email-field.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional
} from 'class-validator';
import { DELEGABLE_PERMISSIONS } from '../../../domain/permission.catalog';
import { Permission } from '../../../domain/enums/permission.enum';

export class InviteAdminRequestDto {
  @EmailField()
  readonly email!: string;

  @ApiPropertyOptional({
    description:
      'Permissions the account receives when the invitation is accepted. Owner-reserved permissions are rejected here: they exist so administrator management has something to require, and can never be held by an administrator.',
    enum: DELEGABLE_PERMISSIONS,
    enumName: 'DelegablePermission',
    isArray: true,
    example: [Permission.USER_READ, Permission.USER_SUSPEND]
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(DELEGABLE_PERMISSIONS.length)
  @IsIn(DELEGABLE_PERMISSIONS, {
    each: true,
    message:
      'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
  })
  readonly permissions?: Permission[];
}
