import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
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
import { TrimLowercase } from '@presentation/validation/decorators/trim-lowercase.decorator';
import { CoinSortField } from '../../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../../domain/enums/sort-order.enum';

const COIN_PAGE_SIZE_DEFAULT = 20;
const COIN_PAGE_SIZE_MAX = 100;
const COIN_SEARCH_MIN_LENGTH = 1;

export { COIN_PAGE_SIZE_DEFAULT, COIN_PAGE_SIZE_MAX, COIN_SEARCH_MIN_LENGTH };

export class CoinListRequestDto {
  @ApiPropertyOptional({
    ...cursorQueryDocs(),
    description: `${cursorQueryDocs().description} The cursor encodes the sort field and direction it was produced under, so changing \`sortBy\` or \`sortOrder\` mid-traversal returns \`400 INVALID_CURSOR\`.`
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: COIN_PAGE_SIZE_DEFAULT,
      max: COIN_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COIN_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring matched against both the coin name and its ticker symbol. Omit to list everything.',
    minLength: COIN_SEARCH_MIN_LENGTH,
    example: 'bit'
  })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  @MinLength(COIN_SEARCH_MIN_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    description: 'Field the page is ordered by.',
    enum: CoinSortField,
    enumName: 'CoinSortField',
    default: CoinSortField.ID,
    example: CoinSortField.NAME
  })
  @IsOptional()
  @IsEnum(CoinSortField)
  sortBy?: CoinSortField;

  @ApiPropertyOptional({
    description: 'Direction the page is ordered in.',
    enum: SortOrder,
    enumName: 'SortOrder',
    default: SortOrder.ASC,
    example: SortOrder.ASC
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
