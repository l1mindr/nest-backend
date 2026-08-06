import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  Permission
} from '../../../domain/enums/permission.enum';
import { DELEGABLE_PERMISSIONS } from '../../../domain/permission.catalog';

/**
 * The permissions a grant or revoke request applies.
 *
 * Restricted to `DELEGABLE_PERMISSIONS` so an owner-reserved code is refused by
 * validation, exactly as the invitation body refuses it: the reservation means
 * there is nobody such a grant could ever be given to. The evaluation service
 * still enforces it independently, so a row inserted behind the API buys
 * nothing, but a well-formed request should fail early and with a validation
 * answer rather than a runtime refusal.
 */
export class PermissionSetRequestDto {
  @ApiProperty({
    description:
      'Delegable permission codes to apply. Owner-reserved permissions cannot be granted and are rejected here.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ, Permission.USER_UPDATE]
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsIn(DELEGABLE_PERMISSIONS, {
    each: true,
    message:
      'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
  })
  readonly permissions!: Permission[];
}
