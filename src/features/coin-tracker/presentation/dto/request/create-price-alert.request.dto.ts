import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Validate
} from 'class-validator';
import { TrimLowercase } from '@presentation/validation/decorators/trim-lowercase.decorator';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { FutureDateValidator } from '../../validators/future-date.validator';

export class CreatePriceAlertRequestDto {
  @ApiProperty({
    description:
      'CoinGecko identifier of the coin to watch, as returned in `id` by `GET /v1/coins`. Lowercased before lookup. The coin must still be active, otherwise `404 COIN_NOT_FOUND` is returned.',
    example: 'bitcoin'
  })
  @TrimLowercase()
  @IsNotEmpty()
  @IsString()
  coinId!: string;

  @ApiProperty({
    description:
      'Price in USD at which the alert fires. Sent as a JSON number; it is echoed back as a decimal string.',
    type: Number,
    format: 'double',
    exclusiveMinimum: true,
    minimum: 0,
    example: 120000
  })
  @IsNumber()
  @IsPositive()
  targetPrice!: number;

  @ApiProperty({
    description:
      'Which way the price must cross `targetPrice`. `BUY` fires when the price falls to or below it, `SELL` when the price rises to or above it.',
    enum: AlertDirection,
    enumName: 'AlertDirection',
    example: AlertDirection.SELL
  })
  @IsEnum(AlertDirection)
  direction!: AlertDirection;

  @ApiProperty({
    description:
      '`ONCE` moves the alert to `TRIGGERED` on the first crossing; `REPEAT` keeps it `ACTIVE` and notifies again on every subsequent crossing, subject to the notification cooldown.',
    enum: AlertTriggerMode,
    enumName: 'AlertTriggerMode',
    example: AlertTriggerMode.ONCE
  })
  @IsEnum(AlertTriggerMode)
  triggerMode!: AlertTriggerMode;

  @ApiPropertyOptional({
    description:
      'ISO-8601 instant after which the alert stops being evaluated. Must be strictly in the future, otherwise `422 INVALID_EXPIRATION` is returned. Omit or send `null` for an alert that never expires.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: ExampleValue.EXPIRES_AT
  })
  @IsOptional()
  @IsISO8601()
  @Validate(FutureDateValidator)
  expiresAt?: string | null;

  @ApiProperty({
    description:
      'Where to deliver the notification. Must contain at least one channel and no duplicates.',
    enum: NotificationChannel,
    enumName: 'NotificationChannel',
    isArray: true,
    minItems: 1,
    uniqueItems: true,
    example: [NotificationChannel.EMAIL]
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  notificationChannels!: NotificationChannel[];
}
