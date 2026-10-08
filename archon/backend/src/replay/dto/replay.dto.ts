import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReplayDto {
  @ApiProperty({ example: 'clx-policy-version-id' })
  @IsString()
  @IsNotEmpty()
  policyVersionId!: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-10-08T00:00:00.000Z' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ example: 'Tighter slippage trial' })
  @IsString()
  @IsOptional()
  name?: string;
}
