import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/** Route parameters for endpoints addressing one role assignment. */
export class UserRoleParamsDto {
  @ApiProperty({
    description: 'Identifier of the account, as a UUID.',
    format: 'uuid',
    example: ExampleValue.USER_ID
  })
  @IsString()
  @IsUUID()
  readonly id!: string;

  @ApiProperty({
    description: 'Identifier of the role, as a UUID.',
    format: 'uuid',
    example: ExampleValue.ADMIN_ID
  })
  @IsString()
  @IsUUID()
  readonly roleId!: string;
}
