import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { WalletAddressRequestDto } from './wallet-address.request.dto';

export class UpdateWalletRequestDto {
  @ApiPropertyOptional({
    description: 'Display name of the wallet.',
    example: 'Ledger X'
  })
  @IsOptional()
  @Trim()
  @MinLength(1)
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'The wallet’s complete address set. This **replaces** whatever is stored: a network left out is removed, a new network is added, and a changed address is updated. Pass an empty array to clear every address.',
    type: [WalletAddressRequestDto]
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique((entry: WalletAddressRequestDto) => entry.network, {
    message: 'each network may appear only once per wallet'
  })
  @ValidateNested({ each: true })
  @Type(() => WalletAddressRequestDto)
  addresses?: WalletAddressRequestDto[];
}
