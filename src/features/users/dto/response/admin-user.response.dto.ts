import { TimestampResponseDto } from '@core/common/dto/timestamp-response.dto';
import { UserRole } from '@features/users/enums/user-role.enum';
import { UserStatus } from '@features/users/enums/user-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class AdminUserResponseDto extends TimestampResponseDto {
  @ApiProperty({
    example: 'uuid'
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
    nullable: true,
    required: false
  })
  @Expose()
  name: string | null;

  @ApiProperty({
    example: 'john_doe'
  })
  @Expose()
  username: string;

  @ApiProperty({
    example: 'john@example.com'
  })
  @Expose()
  email: string;

  @ApiProperty({
    enum: UserRole
  })
  @Expose()
  role: UserRole;

  @ApiProperty({
    enum: UserStatus
  })
  @Expose()
  status: UserStatus;

  @ApiProperty({
    example: '2024-10-01T12:34:56.000Z'
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates.createdAt)
  registeredAt: Date;
}
