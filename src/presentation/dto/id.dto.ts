import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ExampleValue } from '../swagger/openapi.constants';

/** Route parameter for endpoints addressing a single resource by UUID. */
export class IdDto {
  @ApiProperty({
    description: 'Identifier of the resource, as a UUID.',
    format: 'uuid',
    example: ExampleValue.PRICE_ALERT_ID
  })
  @IsString()
  @IsUUID()
  readonly id!: string;
}
