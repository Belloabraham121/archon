import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntentConstraintsDto {
  @ApiPropertyOptional({ example: 50, minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  maximum_slippage_bps?: number;

  @ApiPropertyOptional({ example: 100, minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  maximum_fee_bps?: number;

  @ApiPropertyOptional({ example: ['demo-amm', 'demo-rfq'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  approved_venues?: string[];

  @ApiPropertyOptional({ example: '100000' })
  @IsString()
  @Matches(/^(?=.*[1-9])\d+(\.\d+)?$/, { message: 'maximum_amount must be a positive decimal string' })
  @IsOptional()
  maximum_amount?: string;
}

export class CreateIntentDto {
  @ApiProperty({ example: 'swap', enum: ['swap', 'pay', 'withdraw', 'rebalance', 'transfer'] })
  @IsIn(['swap', 'pay', 'withdraw', 'rebalance', 'transfer'])
  type!: string;

  @ApiProperty({ example: 'demo' })
  @IsString()
  @IsNotEmpty()
  chain!: string;

  @ApiProperty({ example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  sell_asset!: string;

  @ApiProperty({ example: 'ETH' })
  @IsString()
  @IsNotEmpty()
  buy_asset!: string;

  @ApiProperty({ example: '1000', description: 'Integer or decimal amount encoded as a string.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[1-9])\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @ApiPropertyOptional({ example: { maximum_slippage_bps: 50, approved_venues: ['demo-amm', 'demo-rfq'] } })
  @ValidateNested()
  @Type(() => IntentConstraintsDto)
  @IsOptional()
  constraints?: IntentConstraintsDto;
}
