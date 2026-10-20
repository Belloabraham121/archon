import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class ResolveApprovalDto {
  @IsIn(['approve', 'reject', 'replace'])
  action!: 'approve' | 'reject' | 'replace';

  @ValidateIf((value: ResolveApprovalDto) => value.action === 'reject' || value.action === 'replace')
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ValidateIf((value: ResolveApprovalDto) => value.action === 'replace')
  @IsObject()
  replacement?: { amount?: string; venue?: string };
}
