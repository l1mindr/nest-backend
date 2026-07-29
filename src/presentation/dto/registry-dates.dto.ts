import { ApiProperty } from '@nestjs/swagger';

export class RegistryDatesDto {
  @ApiProperty({
    description: 'The date and time when the entity was created.',
    example: '2023-09-25T12:34:56.789Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The date and time when the entity was last updated.',
    example: '2023-09-25T14:00:00.000Z'
  })
  updatedAt: Date;

  @ApiProperty({
    description:
      'The date and time when the entity was soft-deleted. This is null if not deleted.',
    example: '2023-09-26T09:00:00.000Z',
    nullable: true
  })
  deleteAt?: Date;
}
