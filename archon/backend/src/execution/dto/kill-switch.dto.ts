import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class KillSwitchDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf((value: KillSwitchDto) => value.enabled)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
