import { ISessionDevice } from '@features/sessions/interfaces/session-device.interface';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SessionResponseDto {
  @ApiProperty({
    example: 'e4f8b9a2-1c7d-4d5a-8f3e-9a1b2c3d4e5f'
  })
  @Expose()
  sessionId!: string;

  @ApiProperty({
    example: '192.168.1.1'
  })
  @Expose()
  ipAddress!: string;

  @ApiProperty({
    description: 'Information about the client device'
  })
  @Expose()
  deviceInfo!: ISessionDevice;

  @ApiProperty({
    example: '2026-06-15T12:00:00.000Z'
  })
  @Expose()
  validUntil!: Date;

  @ApiProperty({
    example: '2026-06-10T08:30:00.000Z'
  })
  @Expose()
  lastActivityAt!: Date;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Indicates whether this is the current session'
  })
  @Expose()
  current?: boolean;
}
