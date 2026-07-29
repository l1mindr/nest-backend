import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class IdDto {
  @ApiProperty({
    description: 'The ID must be a string that conforms to the UUID format'
  })
  @IsString()
  @IsUUID()
  readonly id: string;
}
