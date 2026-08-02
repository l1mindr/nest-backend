import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Device types recognised by the user-agent parser. */
export enum SessionDeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop'
}

/**
 * Client fingerprint recorded when the session was issued.
 *
 * Mirrors `ISessionDevice`. It exists as a class so the sessions endpoint
 * publishes a named `SessionDevice` schema instead of the empty object that a
 * bare interface produces.
 */
export class SessionDeviceDto {
  @ApiProperty({
    description:
      'Browser that created the session, as reported by its user agent.',
    example: 'Chrome'
  })
  @Expose()
  browserName!: string;

  @ApiProperty({
    description: 'Major browser version.',
    example: '126.0'
  })
  @Expose()
  browserVersion!: string;

  @ApiProperty({
    description: 'Operating system the browser was running on.',
    example: 'macOS'
  })
  @Expose()
  osName!: string;

  @ApiProperty({
    description: 'Device form factor inferred from the user agent.',
    enum: SessionDeviceType,
    enumName: 'SessionDeviceType',
    example: SessionDeviceType.DESKTOP
  })
  @Expose()
  deviceType!: 'mobile' | 'tablet' | 'desktop';
}
