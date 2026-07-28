import { TimestampResponseDto } from '@infrastructure/http/serialization/dto/timestamp-response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AlertDirection } from '../../enums/alert-direction.enum';
import { AlertStatus } from '../../enums/alert-status.enum';
import { AlertTriggerMode } from '../../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { CoinResponseDto } from './coin.response.dto';

export class PriceAlertResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Unique identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Coin identifier',
    example: 'bitcoin'
  })
  @Expose()
  coinId!: string;

  @ApiProperty({
    description: 'Alert direction',
    enum: AlertDirection
  })
  @Expose()
  direction!: AlertDirection;

  @ApiProperty({
    description: 'Target price in USD',
    example: 120000
  })
  @Expose()
  targetPrice!: string;

  @ApiProperty({
    description: 'Trigger mode',
    enum: AlertTriggerMode
  })
  @Expose()
  triggerMode!: AlertTriggerMode;

  @ApiProperty({
    description: 'Current status',
    enum: AlertStatus
  })
  @Expose()
  status!: AlertStatus;

  @ApiPropertyOptional({
    description: 'Expiration timestamp',
    nullable: true
  })
  @Expose()
  expiresAt!: Date | null;

  @ApiProperty({
    description: 'Notification channels',
    enum: NotificationChannel,
    isArray: true
  })
  @Expose()
  notificationChannels!: NotificationChannel[];

  @ApiProperty({
    description: 'Cooldown minutes between notifications'
  })
  @Expose()
  notificationCooldownMinutes!: number;

  @ApiPropertyOptional({
    description: 'Last checked price',
    nullable: true
  })
  @Expose()
  lastCheckedPrice!: string | null;

  @ApiPropertyOptional({
    description: 'Last triggered timestamp',
    nullable: true
  })
  @Expose()
  lastTriggeredAt!: Date | null;

  @ApiProperty({
    description: 'Number of times triggered'
  })
  @Expose()
  triggeredCount!: number;

  @ApiPropertyOptional({
    description: 'Coin details',
    type: CoinResponseDto
  })
  @Expose()
  @Type(() => CoinResponseDto)
  coin?: CoinResponseDto;
}
