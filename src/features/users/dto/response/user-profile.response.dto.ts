import { TimestampResponseDto } from '@core/common/dto/timestamp-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRole } from '../../enums/user-role.enum';

export class UserProfileResponseDto extends TimestampResponseDto {
  @Expose()
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
    nullable: true,
    required: false
  })
  name: string | null;

  @Expose()
  @ApiProperty({
    example: 'john_doe',
    description: 'Unique username'
  })
  username: string;

  @Expose()
  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address'
  })
  email: string;

  @Expose()
  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'User role'
  })
  role: UserRole;

  @Expose({ name: 'createdAt' })
  @ApiProperty({
    example: '2024-10-01T12:34:56.000Z',
    description: 'Registration date'
  })
  joinedAt: Date;
}
