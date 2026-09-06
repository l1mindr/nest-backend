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
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { PortfolioTransactionMapper } from '../../application/mappers/portfolio-transaction.mapper';
import {
  CREATE_PORTFOLIO_TRANSACTION_USE_CASE,
  DELETE_PORTFOLIO_TRANSACTION_USE_CASE,
  GET_PORTFOLIO_TRANSACTION_USE_CASE,
  ICreatePortfolioTransactionUseCase,
  IDeletePortfolioTransactionUseCase,
  IGetPortfolioTransactionUseCase,
  IListPortfolioTransactionsUseCase,
  IUpdatePortfolioTransactionUseCase,
  LIST_PORTFOLIO_TRANSACTIONS_USE_CASE,
  UPDATE_PORTFOLIO_TRANSACTION_USE_CASE
} from '../../application/interfaces/portfolio.interface';
import { CreatePortfolioTransactionRequestDto } from '../dto/request/create-portfolio-transaction.request.dto';
import { UpdatePortfolioTransactionRequestDto } from '../dto/request/update-portfolio-transaction.request.dto';
import {
  PortfolioTransactionIdParamsDto,
  PortfolioTransactionParamsDto
} from '../dto/request/portfolio-transaction.params.dto';
import { PortfolioTransactionListRequestDto } from '../dto/request/portfolio-transaction-list.request.dto';
import {
  ApiCreatePortfolioTransaction,
  ApiDeletePortfolioTransaction,
  ApiGetPortfolioTransaction,
  ApiListPortfolioTransactions,
  ApiUpdatePortfolioTransaction
} from '../swagger/portfolio.swagger';

@Controller({
  path: 'portfolios/:portfolioId/transactions',
  version: '1'
})
@ApiTags(ApiTagName.PORTFOLIOS)
export class PortfolioTransactionsController {
  constructor(
    @Inject(CREATE_PORTFOLIO_TRANSACTION_USE_CASE)
    private readonly createTransactionUseCase: ICreatePortfolioTransactionUseCase,
    @Inject(LIST_PORTFOLIO_TRANSACTIONS_USE_CASE)
    private readonly listTransactionsUseCase: IListPortfolioTransactionsUseCase,
    @Inject(GET_PORTFOLIO_TRANSACTION_USE_CASE)
    private readonly getTransactionUseCase: IGetPortfolioTransactionUseCase,
    @Inject(UPDATE_PORTFOLIO_TRANSACTION_USE_CASE)
    private readonly updateTransactionUseCase: IUpdatePortfolioTransactionUseCase,
    @Inject(DELETE_PORTFOLIO_TRANSACTION_USE_CASE)
    private readonly deleteTransactionUseCase: IDeletePortfolioTransactionUseCase,
    private readonly transactionMapper: PortfolioTransactionMapper
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatePortfolioTransaction()
  async createTransaction(
    @User() user: UserEntity,
    @Param() params: PortfolioTransactionParamsDto,
    @Body() dto: CreatePortfolioTransactionRequestDto
  ) {
    const transaction = await this.createTransactionUseCase.execute(
      user.id,
      params.portfolioId,
      dto
    );

    return this.transactionMapper.toResponse(transaction);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListPortfolioTransactions()
  async listTransactions(
    @User() user: UserEntity,
    @Param() params: PortfolioTransactionParamsDto,
    @Query() query: PortfolioTransactionListRequestDto
  ) {
    const { items, nextCursor, total } =
      await this.listTransactionsUseCase.execute(
        user.id,
        params.portfolioId,
        query
      );

    return {
      items: this.transactionMapper.toResponseList(items),
      nextCursor,
      total
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiGetPortfolioTransaction()
  async getTransaction(
    @User() user: UserEntity,
    @Param() params: PortfolioTransactionIdParamsDto
  ) {
    const transaction = await this.getTransactionUseCase.execute(
      user.id,
      params.portfolioId,
      params.id
    );

    return this.transactionMapper.toResponse(transaction);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdatePortfolioTransaction()
  async updateTransaction(
    @User() user: UserEntity,
    @Param() params: PortfolioTransactionIdParamsDto,
    @Body() dto: UpdatePortfolioTransactionRequestDto
  ) {
    const transaction = await this.updateTransactionUseCase.execute(
      user.id,
      params.portfolioId,
      params.id,
      dto
    );

    return this.transactionMapper.toResponse(transaction);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeletePortfolioTransaction()
  async deleteTransaction(
    @User() user: UserEntity,
    @Param() params: PortfolioTransactionIdParamsDto
  ) {
    return this.deleteTransactionUseCase.execute(
      user.id,
      params.portfolioId,
      params.id
    );
  }
}
