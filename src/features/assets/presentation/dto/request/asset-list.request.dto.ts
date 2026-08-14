import {
  cursorQueryDocs,
  limitQueryDocs
} from '@presentation/dto/pagination.docs';
import { TrimLowercase } from '@presentation/validation/decorators/trim-lowercase.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';

const ASSETS_PAGE_SIZE_DEFAULT = 20;
const ASSETS_PAGE_SIZE_MAX = 100;
const ASSET_SEARCH_MIN_LENGTH = 1;

export {
  ASSETS_PAGE_SIZE_DEFAULT,
  ASSETS_PAGE_SIZE_MAX,
  ASSET_SEARCH_MIN_LENGTH
};

export class AssetListRequestDto {
  @ApiPropertyOptional({
    ...cursorQueryDocs(),
    description: `${cursorQueryDocs().description} The cursor encodes the asset \`id\` it was produced under; it stays valid only while the underlying page remains unchanged.`
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional(
    limitQueryDocs({
      defaultValue: ASSETS_PAGE_SIZE_DEFAULT,
      max: ASSETS_PAGE_SIZE_MAX
    })
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ASSETS_PAGE_SIZE_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring matched against the asset symbol and name. Omit to list everything.',
    minLength: ASSET_SEARCH_MIN_LENGTH,
    example: 'bit'
  })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  @MinLength(ASSET_SEARCH_MIN_LENGTH)
  search?: string;
}
