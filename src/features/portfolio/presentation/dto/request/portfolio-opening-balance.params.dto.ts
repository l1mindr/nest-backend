import { IsString, IsUUID } from 'class-validator';

export class PortfolioOpeningBalancesParamsDto {
  @IsString()
  @IsUUID()
  portfolioId!: string;
}

export class PortfolioOpeningBalanceParamsDto extends PortfolioOpeningBalancesParamsDto {
  @IsString()
  @IsUUID()
  assetId!: string;
}
