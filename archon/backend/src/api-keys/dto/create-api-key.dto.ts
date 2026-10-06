import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsIn(['test', 'live'])
  @IsOptional()
  environment?: string;
}
