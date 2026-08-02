import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TrimLowercase } from '@presentation/validation/decorators/trim-lowercase.decorator';
import { AlertDirection } from '../../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../../domain/enums/alert-status.enum';

const PRICE_ALERT_PAGE_SIZE_DEFAULT = 20;
const PRICE_ALERT_PAGE_SIZE_MAX = 50;

export { PRICE_ALERT_PAGE_SIZE_DEFAULT, PRICE_ALERT_PAGE_SIZE_MAX };

export class ListPriceAlertsRequestDto {
  @ApiPropertyOptional(cursorQueryDocs())
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: PRICE_ALERT_PAGE_SIZE_DEFAULT,
      max: PRICE_ALERT_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRICE_ALERT_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Return only alerts in this state. Omit to return every state, including cancelled and expired ones.',
    enum: AlertStatus,
    enumName: 'AlertStatus',
    example: AlertStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({
    description: 'Return only alerts watching this direction.',
    enum: AlertDirection,
    enumName: 'AlertDirection',
    example: AlertDirection.SELL
  })
  @IsOptional()
  @IsEnum(AlertDirection)
  direction?: AlertDirection;

  @ApiPropertyOptional({
    description:
      'Return only alerts on this coin, identified by its CoinGecko id. Lowercased before matching.',
    example: 'bitcoin'
  })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  coinId?: string;
}
