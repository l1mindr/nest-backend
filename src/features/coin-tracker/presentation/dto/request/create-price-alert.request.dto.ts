import { ApiProperty } from '@nestjs/swagger';
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
import { TrimLowercase } from '@infrastructure/http/validation/decorators/trim-lowercase.decorator';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertTriggerMode } from '../../../domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { FutureDateValidator } from '../../validators/future-date.validator';

export class CreatePriceAlertRequestDto {
  @ApiProperty({
    description: 'CoinGecko coin identifier',
    example: 'bitcoin'
  })
  @TrimLowercase()
  @IsNotEmpty()
  @IsString()
  coinId!: string;

  @ApiProperty({
    description: 'Target price in USD',
    example: 120000
  })
  @IsNumber()
  @IsPositive()
  targetPrice!: number;

  @ApiProperty({
    description: 'Alert direction',
    enum: AlertDirection,
    example: AlertDirection.SELL
  })
  @IsEnum(AlertDirection)
  direction!: AlertDirection;

  @ApiProperty({
    description: 'Trigger mode',
    enum: AlertTriggerMode,
    example: AlertTriggerMode.ONCE
  })
  @IsEnum(AlertTriggerMode)
  triggerMode!: AlertTriggerMode;

  @ApiProperty({
    description: 'Expiration timestamp (must be in the future)',
    example: '2027-01-01T00:00:00Z',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsISO8601()
  @Validate(FutureDateValidator)
  expiresAt?: string | null;

  @ApiProperty({
    description: 'Notification channels',
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.EMAIL]
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  notificationChannels!: NotificationChannel[];
}
