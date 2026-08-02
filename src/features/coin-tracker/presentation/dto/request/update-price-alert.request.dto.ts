import { ExampleValue } from '@presentation/swagger/openapi.constants';
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
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { FutureDateValidator } from '../../validators/future-date.validator';

/**
 * Partial update of an `ACTIVE` alert. Every field is optional, but the body
 * may not be empty: `{}` is rejected with `422 EMPTY_UPDATE`.
 *
 * `coinId` is absent by design — an alert cannot be moved to another coin.
 */
export class UpdatePriceAlertRequestDto {
  @ApiPropertyOptional({
    description:
      'New target price in USD. Changing it clears `lastCheckedPrice`, so the next evaluation re-establishes which side of the threshold the price is on rather than reporting a false crossing.',
    type: Number,
    format: 'double',
    exclusiveMinimum: true,
    minimum: 0,
    example: 130000
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetPrice?: number;

  @ApiPropertyOptional({
    description:
      'New crossing direction. Like `targetPrice`, changing it clears `lastCheckedPrice`.',
    enum: AlertDirection,
    enumName: 'AlertDirection',
    example: AlertDirection.BUY
  })
  @IsOptional()
  @IsEnum(AlertDirection)
  direction?: AlertDirection;

  @ApiPropertyOptional({
    description: 'New trigger mode.',
    enum: AlertTriggerMode,
    enumName: 'AlertTriggerMode',
    example: AlertTriggerMode.REPEAT
  })
  @IsOptional()
  @IsEnum(AlertTriggerMode)
  triggerMode?: AlertTriggerMode;

  @ApiPropertyOptional({
    description:
      'New expiry, which must be strictly in the future. Send `null` to remove the expiry and let the alert run indefinitely.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: ExampleValue.EXPIRES_AT
  })
  @IsOptional()
  @IsISO8601()
  @Validate(FutureDateValidator)
  expiresAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Replacement set of notification channels. Replaces the existing set outright rather than merging into it.',
    enum: NotificationChannel,
    enumName: 'NotificationChannel',
    isArray: true,
    minItems: 1,
    uniqueItems: true,
    example: [NotificationChannel.EMAIL]
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  notificationChannels?: NotificationChannel[];
}
