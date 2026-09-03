import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Wallet } from '../../domain/entities/wallet.entity';
import { WalletResponseDto } from '../../presentation/dto/response/wallet.response.dto';

@Injectable()
export class WalletMapper {
  toResponse(wallet: Wallet): WalletResponseDto {
    return plainToInstance(WalletResponseDto, wallet, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(wallets: Wallet[]): WalletResponseDto[] {
    return wallets.map((wallet) => this.toResponse(wallet));
  }
}
