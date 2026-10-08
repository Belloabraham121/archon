import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PolicyRulesDto {
  @ApiPropertyOptional({ example: ['demo-amm', 'demo-rfq', 'base-amm', 'base-rfq'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  approved_venues?: string[];

  @ApiPropertyOptional({ example: 100, minimum: 0, maximum: 10000 })
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

  @ApiPropertyOptional({ example: '100000' })
  @IsString()
  @Matches(/^(?=.*[1-9])\d+(\.\d+)?$/, { message: 'maximum_amount must be a positive decimal string' })
  @IsOptional()
  maximum_amount?: string;
}

export class CreatePolicyDto {
  @ApiProperty({ example: 'Treasury transfers' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateVersionDto {
  @ApiProperty({ example: { maximum_slippage_bps: 50, approved_venues: ['demo-amm'] } })
  @ValidateNested()
  @Type(() => PolicyRulesDto)
  rules!: PolicyRulesDto;
}

export class PublishVersionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}

export class SampleQuoteDto {
  @ApiProperty({ example: 'demo-rfq' })
  @IsString()
  @IsNotEmpty()
  venue!: string;

  @ApiProperty({ example: '0.59' })
  @IsString()
  @IsNotEmpty()
  amountOut!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  priceImpactBps!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  feeBps!: number;
}

export class SimulateSampleDto {
  @ApiProperty({ example: '1000' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[1-9])\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @ApiProperty({ type: [SampleQuoteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleQuoteDto)
  quotes!: SampleQuoteDto[];
}

export class SimulatePolicyDto {
  @ApiPropertyOptional({ example: 2, description: 'Version to test. Defaults to the latest version (any status).' })
  @IsInt()
  @Min(1)
  @IsOptional()
  version?: number;

  @ApiProperty({ type: [SimulateSampleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulateSampleDto)
  samples!: SimulateSampleDto[];
}
