import { TimestampResponseDto } from '@presentation/dto/timestamp-response.dto';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { WalletAddressResponseDto } from './wallet-address.response.dto';

/**
 * A wallet registered by the authenticated user, used as a transfer
 * destination. One name, and an address per network it holds funds on.
 */
export class WalletResponseDto extends TimestampResponseDto {
  @ApiProperty({
    description: 'Identifier of the wallet, as a UUID.',
    format: 'uuid',
    example: ExampleValue.WALLET_ID
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Display name of the wallet.',
    example: 'Ledger X'
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description:
      'Every address the wallet holds, at most one per network, ordered by network.',
    type: [WalletAddressResponseDto]
  })
  @Expose()
  @Type(() => WalletAddressResponseDto)
  addresses!: WalletAddressResponseDto[];
}
