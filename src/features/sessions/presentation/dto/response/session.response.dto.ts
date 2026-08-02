import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { SessionDeviceDto } from './session-device.response.dto';

/**
 * One signed-in device.
 *
 * Projected from the `Session` entity, which additionally holds the refresh
 * token hash and the revocation flag — neither is exposed here.
 */
export class SessionResponseDto {
  @ApiProperty({
    description:
      'Identifier of the session. Matches the `sessionId` claim of the access token that created it.',
    format: 'uuid',
    example: ExampleValue.SESSION_ID
  })
  @Expose()
  sessionId!: string;

  @ApiProperty({
    description: 'IP address the session was opened from.',
    example: '203.0.113.42'
  })
  @Expose()
  ipAddress!: string;

  @ApiProperty({
    description: 'Client that opened the session.',
    type: SessionDeviceDto
  })
  @Expose()
  @Type(() => SessionDeviceDto)
  deviceInfo!: SessionDeviceDto;

  @ApiProperty({
    description:
      'Instant at which the session stops being usable and its refresh token can no longer be rotated.',
    format: 'date-time',
    example: ExampleValue.EXPIRES_AT
  })
  @Expose()
  validUntil!: Date;

  @ApiProperty({
    description: 'Instant of the most recent request made with this session.',
    format: 'date-time',
    example: ExampleValue.TIMESTAMP
  })
  @Expose()
  lastActivityAt!: Date;
}
