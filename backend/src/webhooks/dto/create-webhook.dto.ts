import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(8)
  @IsIn(['execution.submitted', 'execution.confirmed', 'execution.failed', 'approval.resolved'], { each: true })
  events!: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
