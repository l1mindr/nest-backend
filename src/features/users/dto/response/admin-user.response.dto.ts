import { TimestampResponseDto } from '@core/common/dto/timestamp-response.dto';
import { UserRole } from '@features/users/enums/user-role.enum';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AdminUserResponseDto extends TimestampResponseDto {
  @Expose()
  @ApiProperty({
    example: 'uuid'
  })
  id: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
    nullable: true,
    required: false
  })
  name: string | null;

  @Expose()
  @ApiProperty({
    example: 'john_doe'
  })
  username: string;

  @Expose()
  @ApiProperty({
    example: 'john@example.com'
  })
  email: string;

  @Expose()
  @ApiProperty({
    enum: UserRole
  })
  role: UserRole;

  @Expose()
  @ApiProperty({
    enum: UserStatus
  })
  status: UserStatus;

  @Expose({ name: 'createdAt' })
  @ApiProperty({
    example: '2024-10-01T12:34:56.000Z'
  })
  registeredAt: Date;
}
