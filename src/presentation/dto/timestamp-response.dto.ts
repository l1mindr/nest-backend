import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ExampleValue } from '../swagger/openapi.constants';

/**
 * Creation and modification instants shared by resources that expose them.
 *
 * Deliberately does not declare `deletedAt`: only the admin user projection
 * surfaces a deletion timestamp, and it maps that field itself from the
 * embedded `registryDates`.
 */
export abstract class TimestampResponseDto {
  @ApiProperty({
    description: 'Instant at which the resource was created.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Instant at which the resource was last modified.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  updatedAt: Date;
}
