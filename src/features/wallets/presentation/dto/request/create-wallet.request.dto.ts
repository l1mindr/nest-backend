import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { WalletAddressRequestDto } from './wallet-address.request.dto';

export class CreateWalletRequestDto {
  @ApiProperty({
    description:
      'Display name of the wallet. Free text — the wallet is one identity that may hold addresses on several networks.',
    example: 'Ledger X'
  })
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Addresses this wallet holds, at most one per network. Omit or pass an empty array to register a wallet with no addresses yet.',
    type: [WalletAddressRequestDto]
  })
  @IsOptional()
  @IsArray()
  // A network may appear only once per wallet; the `wallet_address` unique
  // constraint enforces the same rule at the database.
  @ArrayUnique((entry: WalletAddressRequestDto) => entry.network, {
    message: 'each network may appear only once per wallet'
  })
  @ValidateNested({ each: true })
  @Type(() => WalletAddressRequestDto)
  addresses?: WalletAddressRequestDto[];
}
