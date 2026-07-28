import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export abstract class TimestampResponseDto {
  @ApiProperty({
    description: 'Timestamp when the resource was created'
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the resource was last updated'
  })
  @Expose()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the resource was deleted',
    nullable: true
  })
  @Expose()
  deletedAt?: Date | null;
}
