import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Wallet } from '../../domain/entities/wallet.entity';
import { WalletResponseDto } from '../../presentation/dto/response/wallet.response.dto';

@Injectable()
export class WalletMapper {
  toResponse(wallet: Wallet): WalletResponseDto {
    return plainToInstance(
      WalletResponseDto,
      {
        ...wallet,
        // The relation is lazy in some read paths and empty in others; a
        // wallet with no addresses answers with `[]` rather than `undefined`,
        // so the client never has to distinguish "none" from "not loaded".
        addresses: wallet.addresses ?? []
      },
      { excludeExtraneousValues: true }
    );
  }

  toResponseList(wallets: Wallet[]): WalletResponseDto[] {
    return wallets.map((wallet) => this.toResponse(wallet));
  }
}
