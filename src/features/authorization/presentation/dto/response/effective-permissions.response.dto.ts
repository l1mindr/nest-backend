import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Permission } from '../../../domain/enums/permission.enum';

/**
 * What the calling account can do right now.
 *
 * Exists so a client can render its navigation from the same source the server
 * enforces, instead of inferring reach from the role and drifting out of step
 * with it.
 */
export class EffectivePermissionsResponseDto {
  @ApiProperty({
    description: 'Role tier held by the calling account.',
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.ADMIN
  })
  @Expose()
  role!: UserRole;

  @ApiProperty({
    description:
      'Permissions the caller currently holds. Reported as the complete set for the owner, who bypasses evaluation, and as empty for an ordinary user.',
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.USER_READ]
  })
  @Expose()
  permissions!: Permission[];
}
