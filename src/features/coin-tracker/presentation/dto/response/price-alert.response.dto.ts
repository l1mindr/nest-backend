import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { CoinResponseDto } from './coin.response.dto';

/**
 * A price alert owned by the authenticated user.
 *
 * Monetary fields are Postgres `decimal` columns and are therefore returned as
 * strings, not numbers, so no precision is lost in transit. They are accepted
 * as numbers on the way in.
 */
export class PriceAlertResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the alert.',
    format: 'uuid',
    example: ExampleValue.PRICE_ALERT_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'CoinGecko identifier of the watched coin.',
    example: 'bitcoin'
  })
  @Expose()
  coinId!: string;

  @ApiProperty({
    description: 'Which way the price must cross `targetPrice` to fire.',
    enum: AlertDirection,
    enumName: 'AlertDirection',
    example: AlertDirection.SELL
  })
  @Expose()
  direction!: AlertDirection;

  @ApiProperty({
    description:
      'Threshold price in USD, as a decimal string. Sent as a number when creating or updating the alert.',
    type: String,
    example: '120000'
  })
  @Expose()
  targetPrice!: string;

  @ApiProperty({
    description: 'Whether the alert fires once or on every crossing.',
    enum: AlertTriggerMode,
    enumName: 'AlertTriggerMode',
    example: AlertTriggerMode.ONCE
  })
  @Expose()
  triggerMode!: AlertTriggerMode;

  @ApiProperty({
    description:
      'Lifecycle state. Only `ACTIVE` alerts are evaluated and only `ACTIVE` alerts can be updated or cancelled.',
    enum: AlertStatus,
    enumName: 'AlertStatus',
    example: AlertStatus.ACTIVE
  })
  @Expose()
  status!: AlertStatus;

  @ApiProperty({
    description:
      'Instant after which the alert stops being evaluated, or `null` when it never expires.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: ExampleValue.EXPIRES_AT
  })
  @Expose()
  expiresAt!: Date | null;

  @ApiProperty({
    description: 'Channels the notification is delivered on.',
    enum: NotificationChannel,
    enumName: 'NotificationChannel',
    isArray: true,
    example: [NotificationChannel.EMAIL]
  })
  @Expose()
  notificationChannels!: NotificationChannel[];

  @ApiProperty({
    description:
      'Minimum number of minutes between two notifications for this alert. Only meaningful for `REPEAT` alerts.',
    minimum: 1,
    default: 60,
    example: 60
  })
  @Expose()
  notificationCooldownMinutes!: number;

  @ApiProperty({
    description:
      'Price observed at the previous evaluation, as a decimal string. Used to detect a crossing rather than a level, and reset to `null` whenever `targetPrice` or `direction` changes.',
    type: String,
    nullable: true,
    example: null
  })
  @Expose()
  lastCheckedPrice!: string | null;

  @ApiProperty({
    description: 'Instant the alert last fired, or `null` if it never has.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null
  })
  @Expose()
  lastTriggeredAt!: Date | null;

  @ApiProperty({
    description:
      'How many times the alert has fired. Stays at most 1 for `ONCE` alerts.',
    minimum: 0,
    example: 0
  })
  @Expose()
  triggeredCount!: number;

  @ApiProperty({
    description: 'The watched coin, always resolved alongside the alert.',
    type: CoinResponseDto
  })
  @Expose()
  @Type(() => CoinResponseDto)
  coin!: CoinResponseDto;
}
