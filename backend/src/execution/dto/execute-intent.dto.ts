import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ExecuteIntentDto {
  /** Raw signed EVM transaction for Base, or demo-authorized for the demo adapter. */
  @IsString()
  @MaxLength(200_000)
  authorization!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  signer?: string;
}
