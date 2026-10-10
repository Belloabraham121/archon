import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(30) @Max(3650)
  decisionRetentionDays?: number;
  @IsOptional() @IsIn(['review', 'deterministic'])
  judgmentFallback?: 'review' | 'deterministic';
}
