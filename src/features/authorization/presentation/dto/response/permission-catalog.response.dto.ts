import { ApiProperty } from '@nestjs/swagger';
import { PermissionDefinitionResponseDto } from './permission-definition.response.dto';

/**
 * Wrapped in an object rather than returned as a bare array, matching the other
 * collection endpoints and leaving room to describe the catalog itself later
 * without a breaking change.
 */
export class PermissionCatalogResponseDto {
  @ApiProperty({
    description: 'Every permission the system can evaluate, ordered by code.',
    type: [PermissionDefinitionResponseDto]
  })
  items!: PermissionDefinitionResponseDto[];
}
