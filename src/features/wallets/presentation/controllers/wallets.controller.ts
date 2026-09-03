import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { WalletMapper } from '../../application/mappers/wallet.mapper';
import {
  CREATE_WALLET_USE_CASE,
  ICreateWalletUseCase,
  IListWalletsUseCase,
  LIST_WALLETS_USE_CASE
} from '../../application/interfaces/wallet.interface';
import { CreateWalletRequestDto } from '../dto/request/create-wallet.request.dto';
import { ApiCreateWallet, ApiListWallets } from '../swagger/wallet.swagger';

@Controller({
  path: 'wallets',
  version: '1'
})
@ApiTags(ApiTagName.WALLETS)
export class WalletsController {
  constructor(
    @Inject(CREATE_WALLET_USE_CASE)
    private readonly createWalletUseCase: ICreateWalletUseCase,
    @Inject(LIST_WALLETS_USE_CASE)
    private readonly listWalletsUseCase: IListWalletsUseCase,
    private readonly walletMapper: WalletMapper
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateWallet()
  async createWallet(
    @User() user: UserEntity,
    @Body() dto: CreateWalletRequestDto
  ) {
    const wallet = await this.createWalletUseCase.execute(user.id, dto);

    return this.walletMapper.toResponse(wallet);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListWallets()
  async listWallets(@User() user: UserEntity) {
    const wallets = await this.listWalletsUseCase.execute(user.id);

    return this.walletMapper.toResponseList(wallets);
  }
}
