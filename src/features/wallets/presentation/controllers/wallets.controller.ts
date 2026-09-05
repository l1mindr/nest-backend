import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { IdDto } from '@presentation/dto/id.dto';
import { WalletMapper } from '../../application/mappers/wallet.mapper';
import {
  CREATE_WALLET_USE_CASE,
  DELETE_WALLET_USE_CASE,
  ICreateWalletUseCase,
  IDeleteWalletUseCase,
  IListWalletsUseCase,
  IUpdateWalletUseCase,
  LIST_WALLETS_USE_CASE,
  UPDATE_WALLET_USE_CASE
} from '../../application/interfaces/wallet.interface';
import { CreateWalletRequestDto } from '../dto/request/create-wallet.request.dto';
import { UpdateWalletRequestDto } from '../dto/request/update-wallet.request.dto';
import {
  ApiCreateWallet,
  ApiDeleteWallet,
  ApiListWallets,
  ApiUpdateWallet
} from '../swagger/wallet.swagger';

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
    @Inject(UPDATE_WALLET_USE_CASE)
    private readonly updateWalletUseCase: IUpdateWalletUseCase,
    @Inject(DELETE_WALLET_USE_CASE)
    private readonly deleteWalletUseCase: IDeleteWalletUseCase,
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

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateWallet()
  async updateWallet(
    @User() user: UserEntity,
    @Param() params: IdDto,
    @Body() dto: UpdateWalletRequestDto
  ) {
    const wallet = await this.updateWalletUseCase.execute(
      params.id,
      user.id,
      dto
    );

    return this.walletMapper.toResponse(wallet);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteWallet()
  async deleteWallet(@User() user: UserEntity, @Param() params: IdDto) {
    await this.deleteWalletUseCase.execute(params.id, user.id);
  }
}
