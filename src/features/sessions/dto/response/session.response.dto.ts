import { ISessionUserAgent } from '@features/sessions/interfaces/session-user-agent.interface';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class SessionResponseDto {
  @ApiProperty({
    example: 'e4f8b9a2-1c7d-4d5a-8f3e-9a1b2c3d4e5f'
  })
  @Expose()
  @Transform(({ obj }) => obj.id)
  sessionId: string;

  @ApiProperty({
    example: '192.168.1.1'
  })
  @Expose()
  ipAddress: string;

  @ApiProperty({
    description: 'Information about the client device'
  })
  @Expose()
  @Transform(({ obj }) => obj.userAgent)
  device: ISessionUserAgent;

  @ApiProperty({
    example: '2026-06-15T12:00:00.000Z'
  })
  @Expose()
  @Transform(({ obj }) => obj.expiresAt)
  validUntil: Date;

  @ApiProperty({
    example: '2026-06-10T08:30:00.000Z'
  })
  @Expose()
  @Transform(({ obj }) => obj.lastUsedAt)
  lastActivityAt: Date;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Indicates whether this is the current session'
  })
  @Expose()
  current?: boolean;
}
