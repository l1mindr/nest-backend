import { Trim } from '@presentation/validation/decorators/trim.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { WalletNetwork } from '../../../domain/enums/wallet-network.enum';
import { IsWalletAddressForNetwork } from '../../validation/is-wallet-address.validator';

/** One network-specific address in a wallet's address set. */
export class WalletAddressRequestDto {
  @ApiProperty({
    description: 'Blockchain network this address belongs to.',
    enum: WalletNetwork,
    enumName: 'WalletNetwork',
    example: WalletNetwork.SOLANA
  })
  @IsEnum(WalletNetwork)
  network!: WalletNetwork;

  @ApiProperty({
    description:
      'Address on the selected network. Validated against that network’s address format — prefix, alphabet and length. Checksums are not verified.',
    example: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  })
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @IsWalletAddressForNetwork('network')
  address!: string;
}
