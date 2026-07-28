import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TrimLowercase } from '@infrastructure/http/validation/decorators/trim-lowercase.decorator';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';

const PRICE_ALERT_PAGE_SIZE_DEFAULT = 20;
const PRICE_ALERT_PAGE_SIZE_MAX = 50;

export { PRICE_ALERT_PAGE_SIZE_DEFAULT, PRICE_ALERT_PAGE_SIZE_MAX };

export class ListPriceAlertsRequestDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor obtained from a previous response. Omit to start from the beginning.'
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Number of items to return per page (1–${PRICE_ALERT_PAGE_SIZE_MAX}). Defaults to ${PRICE_ALERT_PAGE_SIZE_DEFAULT}.`,
    minimum: 1,
    maximum: PRICE_ALERT_PAGE_SIZE_MAX,
    default: PRICE_ALERT_PAGE_SIZE_DEFAULT
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRICE_ALERT_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by alert status',
    enum: AlertStatus
  })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({
    description: 'Filter by direction',
    enum: AlertDirection
  })
  @IsOptional()
  @IsEnum(AlertDirection)
  direction?: AlertDirection;

  @ApiPropertyOptional({
    description: 'Filter by coin identifier'
  })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  coinId?: string;
}
