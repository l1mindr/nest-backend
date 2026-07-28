import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  Validate
} from 'class-validator';
import { AlertDirection } from '../../enums/alert-direction.enum';
import { AlertTriggerMode } from '../../enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { FutureDateValidator } from '../../validators/future-date.validator';

export class UpdatePriceAlertRequestDto {
  @ApiPropertyOptional({
    description: 'Target price in USD',
    example: 130000
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetPrice?: number;

  @ApiPropertyOptional({
    description: 'Alert direction',
    enum: AlertDirection
  })
  @IsOptional()
  @IsEnum(AlertDirection)
  direction?: AlertDirection;

  @ApiPropertyOptional({
    description: 'Trigger mode',
    enum: AlertTriggerMode
  })
  @IsOptional()
  @IsEnum(AlertTriggerMode)
  triggerMode?: AlertTriggerMode;

  @ApiPropertyOptional({
    description: 'Expiration timestamp (must be in the future)',
    nullable: true
  })
  @IsOptional()
  @IsISO8601()
  @Validate(FutureDateValidator)
  expiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Notification channels',
    enum: NotificationChannel,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  notificationChannels?: NotificationChannel[];
}
