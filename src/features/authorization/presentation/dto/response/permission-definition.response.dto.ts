import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Permission } from '../../../domain/enums/permission.enum';

/** One entry of the permission catalog. */
export class PermissionDefinitionResponseDto {
  @ApiProperty({
    description: 'Permission code, as accepted by the grant endpoints.',
    enum: Permission,
    enumName: 'Permission',
    example: Permission.USER_READ
  })
  @Expose()
  code!: Permission;

  @ApiProperty({
    description: 'What holding this permission allows.',
    example: 'Read any user account and list the directory.'
  })
  @Expose()
  description!: string;
}
