import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { UserRole } from '../../../domain/enums/user-role.enum';

/**
 * The authenticated user's own profile.
 *
 * Deliberately does not extend `TimestampResponseDto`: the `User` entity keeps
 * its timestamps in the embedded `registryDates`, so inherited `createdAt` /
 * `updatedAt` fields would be documented but never populated. The creation
 * instant is exposed as `joinedAt` instead.
 */
export class UserProfileResponseDto {
  @ApiPropertyOptional({
    description:
      'Display name. `null` until the user sets one through `PUT /v1/user`.',
    type: String,
    nullable: true,
    example: ExampleValue.NAME
  })
  @Expose()
  name!: string | null;

  @ApiProperty({
    description: 'Unique username, always lowercase.',
    example: ExampleValue.USERNAME
  })
  @Expose()
  username!: string;

  @ApiProperty({
    description: 'Email address the account is registered under.',
    format: 'email',
    example: ExampleValue.EMAIL
  })
  @Expose()
  email!: string;

  @ApiProperty({
    description: 'Role held by the account. Governs access to `/v1/admin/*`.',
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER
  })
  @Expose()
  role!: UserRole;

  @ApiProperty({
    description: 'Instant at which the account was registered.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  @Transform(({ obj }) => obj.registryDates?.createdAt ?? obj.createdAt)
  joinedAt!: Date;
}
