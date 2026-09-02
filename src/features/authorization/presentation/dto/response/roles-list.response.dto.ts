import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from './role.response.dto';

export class RolesListResponseDto {
  @ApiProperty({
    description: 'Every role in the catalog.',
    type: [RoleResponseDto]
  })
  items!: RoleResponseDto[];
}
