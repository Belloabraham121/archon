import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ExecuteIntentDto {
  /** Already-signed EVM transaction for an RPC-enabled chain, or adapter-specific explicit authorization. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  authorization?: string;

  /** Hash returned by a Tempo-compatible wallet after it broadcasts. */
  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'transactionHash must be a 32-byte 0x-prefixed hash' })
  transactionHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  signer?: string;
}
