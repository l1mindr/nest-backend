import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../../domain/enums/permission.enum';

/** The permissions a grant or revoke request applies. */
export class PermissionSetRequestDto {
  @ApiProperty({
    description:
      'Permission codes to apply. Validated against the catalog, so an unknown code is rejected before it can reach the grant table.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ, Permission.USER_UPDATE]
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsEnum(Permission, { each: true })
  readonly permissions!: Permission[];
}
