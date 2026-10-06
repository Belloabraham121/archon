import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateIntentDto {
  @IsIn(['swap', 'pay', 'withdraw', 'rebalance', 'transfer'])
  type!: string;

  @IsString()
  @IsNotEmpty()
  chain!: string;

  @IsString()
  @IsNotEmpty()
  sell_asset!: string;

  @IsString()
  @IsNotEmpty()
  buy_asset!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsObject()
  @IsOptional()
  constraints?: Record<string, unknown>;
}
