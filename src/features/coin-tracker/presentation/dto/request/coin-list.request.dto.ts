import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrimLowercase } from '@infrastructure/http/validation/decorators/trim-lowercase.decorator';
import { CoinSortField } from '../../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../../domain/enums/sort-order.enum';

const COIN_PAGE_SIZE_DEFAULT = 20;
const COIN_PAGE_SIZE_MAX = 100;

export { COIN_PAGE_SIZE_DEFAULT, COIN_PAGE_SIZE_MAX };

export class CoinListRequestDto {
  @ApiPropertyOptional({
    description:
      'Opaque cursor obtained from a previous response. Omit to start from the beginning.'
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Number of items to return per page (1–${COIN_PAGE_SIZE_MAX}). Defaults to ${COIN_PAGE_SIZE_DEFAULT}.`,
    minimum: 1,
    maximum: COIN_PAGE_SIZE_MAX,
    default: COIN_PAGE_SIZE_DEFAULT
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COIN_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search query to filter coins by name or symbol'
  })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  @MinLength(1)
  search?: string;

  @ApiPropertyOptional({
    description: 'Field used to sort coins',
    enum: CoinSortField,
    default: CoinSortField.ID
  })
  @IsOptional()
  @IsEnum(CoinSortField)
  sortBy?: CoinSortField;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.ASC
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
