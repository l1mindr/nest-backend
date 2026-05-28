import { TimestampResponseDto } from '@core/common/dto/timestamp-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { UserRole } from '../../enums/user-role.enum';

export class UserProfileResponseDto extends TimestampResponseDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
    nullable: true,
    required: false
  })
  @Expose()
  name: string | null;

  @ApiProperty({
    example: 'john_doe',
    description: 'Unique username'
  })
  @Expose()
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address'
  })
  @Expose()
  email: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'User role'
  })
  @Expose()
  role: UserRole;

  @ApiProperty({
    example: '2024-10-01T12:34:56.000Z',
    description: 'Registration date'
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.createdAt)
  joinedAt: Date;
}
